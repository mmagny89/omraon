<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Entity\User;
use App\Service\FichesService;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\Tools\SchemaTool;
use Symfony\Bundle\FrameworkBundle\KernelBrowser;
use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Symfony\Component\HttpFoundation\File\UploadedFile;

final class IllustrationTest extends WebTestCase
{
    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
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

    private function fichier(string $contenu, string $nom, string $mime): UploadedFile
    {
        $chemin = tempnam(sys_get_temp_dir(), 'illu');
        file_put_contents($chemin, $contenu);

        return new UploadedFile($chemin, $nom, $mime, null, true);
    }

    /** Le jeton se lit dans le formulaire de la page de la fiche, comme le ferait un admin. */
    private function jeton(string $type, string $cle): string
    {
        $page = ['astre' => '/astres/', 'site' => '/sites/', 'personnage' => '/personnages/'][$type].$cle;

        return (string) $this->client->request('GET', $page)->filter('form[enctype] input[name=_token]')->attr('value');
    }

    public function testAnonymeRedirige(): void
    {
        $this->client->request('GET', '/illustrations/astre/kebet');
        self::assertResponseRedirects('http://localhost/connexion');
    }

    public function testToutesLesIllustrationsGenereesSontDuSvgValide(): void
    {
        $this->connecter(false);
        $f = static::getContainer()->get(FichesService::class);
        $urls = [];
        foreach ($f->astres() as $a) {
            $urls[] = '/illustrations/astre/'.$a['id'];
        }
        foreach ($f->sites() as $s) {
            $urls[] = '/illustrations/site/'.$s->id;
        }
        foreach ($f->personnages() as $p) {
            $urls[] = '/illustrations/personnage/'.$p->id;
        }
        self::assertGreaterThan(60, \count($urls));
        foreach ($urls as $url) {
            $this->client->request('GET', $url);
            self::assertResponseIsSuccessful($url);
            $r = $this->client->getResponse();
            self::assertSame('image/svg+xml', $r->headers->get('Content-Type'), $url);
            self::assertSame('nosniff', $r->headers->get('X-Content-Type-Options'));
            self::assertStringContainsString("default-src 'none'", (string) $r->headers->get('Content-Security-Policy'));
            $doc = new \DOMDocument();
            self::assertTrue(@$doc->loadXML((string) $r->getContent()), "SVG invalide : $url");
            self::assertStringNotContainsString('<script', (string) $r->getContent());
        }
    }

    public function testInconnuRenvoie404EtEtagRenvoie304(): void
    {
        $this->connecter(false);
        $this->client->request('GET', '/illustrations/astre/nexiste-pas');
        self::assertResponseStatusCodeSame(404);
        $this->client->request('GET', '/illustrations/astre/kebet');
        $etag = $this->client->getResponse()->headers->get('ETag');
        self::assertNotNull($etag);
        $this->client->request('GET', '/illustrations/astre/kebet', server: ['HTTP_IF_NONE_MATCH' => $etag]);
        self::assertResponseStatusCodeSame(304);
    }

    public function testLecteurNePeutPasTeleverser(): void
    {
        $this->connecter(false);
        $this->client->request('POST', '/admin/illustrations/astre/kebet', ['_token' => 'x'], ['image' => $this->fichier((string) base64_decode(self::PNG), 'a.png', 'image/png')]);
        self::assertResponseStatusCodeSame(403);
    }

    public function testAdminTeleverseUnPngPuisLeRetire(): void
    {
        $this->connecter(true);
        $jeton = $this->jeton('astre', 'kebet');
        self::assertSelectorExists('form[enctype="multipart/form-data"]');
        $this->client->request('POST', '/admin/illustrations/astre/kebet', ['_token' => $jeton], ['image' => $this->fichier((string) base64_decode(self::PNG), 'a.png', 'image/png')]);
        self::assertResponseRedirects();
        $this->client->request('GET', '/illustrations/astre/kebet');
        self::assertSame('image/png', $this->client->getResponse()->headers->get('Content-Type'));

        $this->client->request('POST', '/admin/illustrations/astre/kebet/supprimer', ['_token' => $jeton]);
        $this->client->request('GET', '/illustrations/astre/kebet');
        self::assertSame('image/svg+xml', $this->client->getResponse()->headers->get('Content-Type'));
    }

    public function testFormatsEtJetonRefuses(): void
    {
        $this->connecter(true);
        $jeton = $this->jeton('site', 'kalpra-mines');
        $svg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
        $this->client->request('POST', '/admin/illustrations/site/kalpra-mines', ['_token' => $jeton], ['image' => $this->fichier($svg, 'x.png', 'image/png')]);
        $this->client->request('GET', '/illustrations/site/kalpra-mines');
        self::assertSame('image/svg+xml', $this->client->getResponse()->headers->get('Content-Type'));
        self::assertStringNotContainsString('alert(1)', (string) $this->client->getResponse()->getContent(), 'le SVG téléversé est refusé');

        $gros = (string) base64_decode(self::PNG).str_repeat('0', 3 * 1024 * 1024);
        $this->client->request('POST', '/admin/illustrations/site/kalpra-mines', ['_token' => $jeton], ['image' => $this->fichier($gros, 'gros.png', 'image/png')]);
        $this->client->request('GET', '/illustrations/site/kalpra-mines');
        self::assertSame('image/svg+xml', $this->client->getResponse()->headers->get('Content-Type'));

        $this->client->request('POST', '/admin/illustrations/site/kalpra-mines', ['_token' => 'mauvais'], ['image' => $this->fichier((string) base64_decode(self::PNG), 'a.png', 'image/png')]);
        self::assertResponseStatusCodeSame(403);
    }
}
