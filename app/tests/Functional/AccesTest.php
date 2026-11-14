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
    }

    public function testLecteurVoitLeSystemeMaisPasLAdmin(): void
    {
        $this->client->loginUser($this->creer('lecteur@example.test'));
        $this->client->request('GET', '/');
        self::assertResponseIsSuccessful();
        $reponse = $this->client->getResponse();
        self::assertInstanceOf(\Symfony\Component\HttpFoundation\BinaryFileResponse::class, $reponse);
        self::assertStringContainsString('Omraon', (string) file_get_contents($reponse->getFile()->getPathname()));
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
}
