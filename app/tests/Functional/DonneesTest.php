<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Entity\User;
use App\Service\DonneesService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class DonneesTest extends WebTestCase
{
    private KernelBrowser $client;
    private EntityManagerInterface $em;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $this->em = static::getContainer()->get(EntityManagerInterface::class);
        $tool = new SchemaTool($this->em);
        $meta = $this->em->getMetadataFactory()->getAllMetadata();
        $tool->dropSchema($meta);
        $tool->createSchema($meta);
    }

    private function connecter(bool $admin): void
    {
        $u = (new User())->setEmail(($admin ? 'a' : 'l').'@example.test')->setNom('x')->setAdmin($admin)->setPassword('x');
        $this->em->persist($u);
        $this->em->flush();
        $this->client->loginUser($u);
    }

    /** @return iterable<string, array{string}> */
    public static function jeux(): iterable
    {
        yield 'systeme' => ['systeme'];
        yield 'sites' => ['sites'];
        yield 'economie' => ['economie'];
    }

    #[DataProvider('jeux')]
    public function testApiRefuseeSansCompte(string $jeu): void
    {
        $this->client->request('GET', '/api/donnees/'.$jeu);
        self::assertResponseRedirects('http://localhost/connexion');
    }

    #[DataProvider('jeux')]
    public function testApiServieAuLecteur(string $jeu): void
    {
        $this->connecter(false);
        $this->client->request('GET', '/api/donnees/'.$jeu);
        self::assertResponseIsSuccessful();
        self::assertStringContainsString('no-store', (string) $this->client->getResponse()->headers->get('Cache-Control'));
        self::assertIsObject(json_decode((string) $this->client->getResponse()->getContent()));
    }

    public function testLeSystemeContientLEtoileEtLesPlanetes(): void
    {
        $this->connecter(false);
        $this->client->request('GET', '/api/donnees/systeme');
        $d = json_decode((string) $this->client->getResponse()->getContent());
        self::assertSame('Omraon', $d->STAR->name);
        self::assertCount(5, $d->PLANETS);
    }

    public function testLecteurNeModifiePasLesValeurs(): void
    {
        $this->connecter(false);
        $this->client->request('GET', '/admin/donnees');
        self::assertResponseStatusCodeSame(403);
        $this->client->request('POST', '/admin/donnees/systeme/STAR', ['valeur' => '{}']);
        self::assertResponseStatusCodeSame(403);
    }

    public function testAdminModifieEtReinitialise(): void
    {
        $this->connecter(true);
        $svc = static::getContainer()->get(DonneesService::class);
        $canon = $svc->canonSection('systeme', 'SYSTEM_EDGE_AU');

        $crawler = $this->client->request('GET', '/admin/donnees/systeme/SYSTEM_EDGE_AU');
        self::assertResponseIsSuccessful();
        $this->client->submitForm('Enregistrer', ['valeur' => '42']);
        self::assertResponseRedirects('/admin/donnees');

        $this->client->request('GET', '/api/donnees/systeme');
        self::assertSame(42, json_decode((string) $this->client->getResponse()->getContent())->SYSTEM_EDGE_AU);

        $this->client->request('GET', '/admin/donnees');
        $this->client->submitForm('Réinitialiser');
        $this->client->request('GET', '/api/donnees/systeme');
        self::assertSame($canon, json_decode((string) $this->client->getResponse()->getContent())->SYSTEM_EDGE_AU);
    }

    public function testValidationRefuseJsonEtTypesIncorrects(): void
    {
        $svc = static::getContainer()->get(DonneesService::class);
        self::assertNotNull($svc->valider('systeme', 'STAR', '{pas du json'));
        self::assertNotNull($svc->valider('systeme', 'STAR', '[1,2]'));
        self::assertNotNull($svc->valider('systeme', 'PLANETS', '[]'));
        self::assertNotNull($svc->valider('systeme', 'PLANETS', '[{"id":"a"},{"id":"a"}]'));
        self::assertNotNull($svc->valider('sites', 'SITES', '[{"name":"sans id"}]'));
        self::assertNull($svc->valider('systeme', 'SYSTEM_EDGE_AU', '40.5'));
    }

    public function testUnObjetVideResteUnObjet(): void
    {
        $svc = static::getContainer()->get(DonneesService::class);
        $svc->enregistrer('systeme', 'COMETS', '{}', 'test');
        $this->connecter(false);
        $this->client->request('GET', '/api/donnees/systeme');
        self::assertStringContainsString('"COMETS":{}', (string) $this->client->getResponse()->getContent());
    }

    public function testRefuseLesBalisesHtmlDansLesValeurs(): void
    {
        $svc = static::getContainer()->get(DonneesService::class);
        foreach (['"<img src=x onerror=alert(1)>"', '"<script>alert(1)</script>"', '"</div><b>x"'] as $texte) {
            self::assertStringContainsString('balise HTML', (string) $svc->valider('systeme', 'BELT', '{"name":'.$texte.'}'), $texte);
        }
        self::assertStringContainsString('balise HTML', (string) $svc->valider('lore', 'PERSONNAGES', '[{"id":"a","resume":"ok <a href=x>lien</a>"}]'));
        self::assertNull($svc->valider('systeme', 'COMETS', '{"count":40,"note":"a < b et 5 > 3"}'), 'un inférieur sans lettre derrière n\'est pas une balise');
    }

    public function testLeCanonEntierResteValide(): void
    {
        $svc = static::getContainer()->get(DonneesService::class);
        foreach (array_keys(DonneesService::JEUX) as $jeu) {
            foreach ($svc->sections($jeu) as $section) {
                self::assertNull($svc->valider($jeu, $section, (string) json_encode($svc->canonSection($jeu, $section))), "$jeu.$section");
            }
        }
    }
}
