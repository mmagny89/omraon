<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

final class AccesTest extends WebTestCase
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

    private function creer(string $email, bool $admin = false, bool $actif = true): User
    {
        $u = (new User())->setEmail($email)->setNom($email)->setAdmin($admin)->setActif($actif);
        $u->setPassword(static::getContainer()->get(UserPasswordHasherInterface::class)->hashPassword($u, 'motdepasse-solide'));
        $this->em->persist($u);
        $this->em->flush();

        return $u;
    }

    /** @return iterable<string, array{string}> */
    public static function urlsProtegees(): iterable
    {
        yield 'accueil' => ['/'];
        yield 'script' => ['/src/main.js'];
        yield 'three' => ['/vendor/three.module.js'];
        yield 'admin' => ['/admin/utilisateurs'];
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('urlsProtegees')]
    public function testAnonymeRedirigeVersConnexion(string $url): void
    {
        $this->client->request('GET', $url);
        self::assertResponseRedirects('http://localhost/connexion');
    }

    public function testConnexionAccessibleSansCompte(): void
    {
        $this->client->request('GET', '/connexion');
        self::assertResponseIsSuccessful();
        self::assertSelectorExists('form input[name=_password]');
        self::assertSelectorExists('link[rel=icon][href*="favicon"]');
        self::assertSelectorExists('img[src*="apercu"][alt]');
        self::assertSelectorTextContains('main', 'Accès réservé');
        self::assertSelectorExists('footer a[href="https://mmagny.fr"]');
        self::assertSelectorExists('footer a[href="https://github.com/mmagny89"]');
    }

    public function testLecteurVoitLeSystemeMaisPasLAdmin(): void
    {
        $this->client->loginUser($this->creer('lecteur@example.test'));
        $this->client->request('GET', '/');
        self::assertResponseIsSuccessful();
        $html = (string) $this->client->getResponse()->getContent();
        self::assertStringContainsString('Omraon', $html);
        self::assertMatchesRegularExpression('#<link rel="stylesheet" href="/assets/styles/vue-[^"]+\.css">#', $html, 'feuille Tailwind de la vue référencée');
        self::assertStringNotContainsString('VUE_CSS', $html);
        $this->client->request('GET', '/src/main.js');
        self::assertResponseIsSuccessful();
        $this->client->request('GET', '/admin/utilisateurs');
        self::assertResponseStatusCodeSame(403);
    }

    public function testAdminGereLesComptes(): void
    {
        $this->client->loginUser($this->creer('admin@example.test', admin: true));
        $this->client->request('GET', '/admin/utilisateurs');
        self::assertResponseIsSuccessful();
    }

    public function testTraversalDeChemin(): void
    {
        $this->client->loginUser($this->creer('l2@example.test'));
        $this->client->request('GET', '/src/..%2f..%2fcomposer.json');
        self::assertResponseStatusCodeSame(404);
        $this->client->request('GET', '/src/../../.env');
        self::assertResponseStatusCodeSame(404);
    }

    public function testConnexionParFormulaire(): void
    {
        $this->creer('ok@example.test');
        $this->client->request('GET', '/connexion');
        $this->client->submitForm('Se connecter', ['_username' => 'ok@example.test', '_password' => 'motdepasse-solide']);
        self::assertResponseRedirects('/');
    }

    public function testCompteDesactiveRefuse(): void
    {
        $this->creer('off@example.test', actif: false);
        $this->client->request('GET', '/connexion');
        $this->client->submitForm('Se connecter', ['_username' => 'off@example.test', '_password' => 'motdepasse-solide']);
        self::assertResponseRedirects('/connexion');
    }

    public function testLeCodeSourceDuFrontNEstPasDansPublic(): void
    {
        self::assertFileDoesNotExist(\dirname(__DIR__, 2).'/public/index.html');
        self::assertFileDoesNotExist(\dirname(__DIR__, 2).'/public/src');
    }

    public function testDeconnexionExigeUnJeton(): void
    {
        $this->client->loginUser($this->creer('csrf@example.test'));
        $this->client->request('GET', '/deconnexion');
        self::assertResponseStatusCodeSame(403);
        $this->client->request('GET', '/');
        self::assertResponseIsSuccessful('toujours connecté : la déconnexion sans jeton est refusée');
    }

    public function testLaVueContientUnLienDeDeconnexionAvecJeton(): void
    {
        $this->client->loginUser($this->creer('vue@example.test'));
        $this->client->request('GET', '/');
        self::assertMatchesRegularExpression('#id="btn-logout" class="tb" href="/deconnexion\?_csrf_token=[^"]+"#', (string) $this->client->getResponse()->getContent());
    }

    public function testLeFaviconEstPubliqueEtLaVueLaReference(): void
    {
        $this->client->request('GET', '/connexion');
        $href = (string) $this->client->getCrawler()->filter('link[rel=icon]')->attr('href');
        $this->client->request('GET', $href);
        self::assertResponseIsSuccessful('le favicon se charge sans compte');
        $this->client->loginUser($this->creer('fav@example.test'));
        $this->client->request('GET', '/');
        self::assertMatchesRegularExpression('#<link rel="icon" href="/assets/favicon-[^"]+\.svg"#', (string) $this->client->getResponse()->getContent());
    }
}
