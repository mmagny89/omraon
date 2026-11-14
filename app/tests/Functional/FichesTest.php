<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Entity\User;
use App\Service\FichesService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;

final class FichesTest extends WebTestCase
{
    private KernelBrowser $client;

    protected function setUp(): void
    {
        $this->client = static::createClient();
        $em = static::getContainer()->get(EntityManagerInterface::class);
        $tool = new SchemaTool($em);
        $meta = $em->getMetadataFactory()->getAllMetadata();
        $tool->dropSchema($meta);
        $tool->createSchema($meta);
        $u = (new User())->setEmail('l@example.test')->setNom('L')->setPassword('x');
        $em->persist($u);
        $em->flush();
        $this->client->loginUser($u);
    }

    public function testAnonymeRedirige(): void
    {
        $this->client->getCookieJar()->clear();
        $this->client->request('GET', '/deconnexion');
        $c = $this->client;
        foreach (['/astres', '/sites', '/personnages', '/scenes', '/lexique', '/chronologie', '/astres/kebet'] as $url) {
            $c->request('GET', $url);
            self::assertResponseRedirects('http://localhost/connexion', null, $url);
        }
    }

    public function testToutesLesPagesDeDetailRepondent(): void
    {
        $f = static::getContainer()->get(FichesService::class);
        $urls = ['/astres', '/sites', '/personnages', '/scenes', '/lexique', '/chronologie'];
        foreach ($f->astres() as $a) {
            $urls[] = '/astres/'.$a['id'];
        }
        foreach ($f->sites() as $s) {
            $urls[] = '/sites/'.$s->id;
            $urls[] = '/scenes/'.$s->id;
        }
        foreach ($f->personnages() as $p) {
            $urls[] = '/personnages/'.$p->id;
        }
        self::assertGreaterThan(40, \count($urls));
        foreach ($urls as $url) {
            $this->client->request('GET', $url);
            self::assertResponseIsSuccessful($url);
        }
    }

    public function testInconnuRenvoie404(): void
    {
        foreach (['/astres/nexiste-pas', '/sites/xx', '/personnages/xx', '/scenes/xx'] as $url) {
            $this->client->request('GET', $url);
            self::assertResponseStatusCodeSame(404, $url);
        }
    }

    public function testFicheDeKebetLieSitesEtPersonnages(): void
    {
        $this->client->request('GET', '/astres/kebet');
        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('body', 'Grands temples');
        self::assertSelectorTextContains('body', 'Eirik');
        self::assertSelectorTextContains('body', 'Gravité de surface');
    }

    public function testAucuneRacineEgyptienneAffichee(): void
    {
        foreach (['/personnages', '/lexique', '/scenes/kebet-temples'] as $url) {
            $this->client->request('GET', $url);
            self::assertDoesNotMatchRegularExpression('/\b(égypt\w*|Horus|Isis|Osiris|Aton|Atoum|Khépri|Nephthys|Maât|Sopdou|Tefnout)\b/iu', (string) $this->client->getResponse()->getContent(), $url);
        }
    }

    public function testEditionAdminVisibleDansLaFiche(): void
    {
        $svc = static::getContainer()->get(\App\Service\DonneesService::class);
        $perso = json_decode(json_encode($svc->section('lore', 'PERSONNAGES')), true);
        $perso[0]['nom'] = 'Nom modifié par admin';
        $svc->enregistrer('lore', 'PERSONNAGES', json_encode($perso), 'test');
        $this->client->request('GET', '/personnages');
        self::assertSelectorTextContains('body', 'Nom modifié par admin');
    }

    public function testBadgesConditionnelsSansAlertePhp(): void
    {
        $alertes = [];
        set_error_handler(static function (int $n, string $m) use (&$alertes): bool {
            $alertes[] = $m;

            return true;
        });
        try {
            $this->client->request('GET', '/sites/kalpra-mines');
            self::assertResponseIsSuccessful();
            self::assertSelectorTextContains('main', 'suggéré');
            $this->client->request('GET', '/personnages/mai');
            self::assertResponseIsSuccessful();
            self::assertSelectorTextContains('main', 'disparu');
        } finally {
            restore_error_handler();
        }
        self::assertSame([], $alertes, 'aucune alerte PHP au rendu');
        self::assertStringNotContainsString('Array', (string) $this->client->getResponse()->getContent());
    }

    public function testPastillesDeProvenance(): void
    {
        $this->client->request('GET', '/astres/kebet');
        self::assertSelectorTextContains('main', 'calculé');
        self::assertSelectorTextContains('main', 'suggéré');
        self::assertSelectorNotExists('[title^="Section"]', 'rien de modifié au départ');
        $this->client->request('GET', '/astres/omraon');
        self::assertSelectorTextContains('main', 'canon');
        $this->client->request('GET', '/lexique');
        self::assertSelectorTextContains('main', 'canon');
        self::assertSelectorTextContains('footer', 'Légende des pastilles');
    }

    public function testPastilleModifieApresEditionAdmin(): void
    {
        $svc = static::getContainer()->get(\App\Service\DonneesService::class);
        $this->client->request('GET', '/api/donnees/modifications');
        self::assertSame('{}', (string) $this->client->getResponse()->getContent());
        $sys = json_decode(json_encode($svc->section('systeme', 'PLANETS')), true);
        $svc->enregistrer('systeme', 'PLANETS', json_encode($sys), 'admin@example.test');
        $this->client->request('GET', '/astres/kebet');
        self::assertSelectorExists('[title*="PLANETS"][title*="un administrateur"]');
        self::assertStringNotContainsString('admin@example.test', (string) $this->client->getResponse()->getContent(), 'l\'email de l\'admin n\'est pas montré à un lecteur');
        $this->client->request('GET', '/astres/omraon');
        self::assertSelectorNotExists('[title*="PLANETS"]', 'l\'étoile n\'est pas dans PLANETS');
        $this->client->request('GET', '/api/donnees/modifications');
        $m = json_decode((string) $this->client->getResponse()->getContent(), true);
        self::assertSame('un administrateur', $m['systeme']['PLANETS']['par'], 'un lecteur ne voit pas qui a modifié');
    }

    public function testChronologieMontreLesPenuriesOrganisees(): void
    {
        $crawler = $this->client->request('GET', '/chronologie');
        self::assertResponseIsSuccessful();
        self::assertSelectorTextContains('main', 'Pénurie organisée — le Bas');
        self::assertSelectorTextContains('main', 'Pénuries organisées par le Consortium');
        self::assertGreaterThanOrEqual(8, $crawler->filter('section[aria-labelledby=penuries] li')->count());
    }
}
