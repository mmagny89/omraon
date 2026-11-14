<?php

declare(strict_types=1);

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Asset\Packages;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Security\Http\Logout\LogoutUrlGenerator;
use Symfony\Component\Routing\Attribute\Route;

/**
 * Sert la vue du système (HTML, JS, CSS, Three.js) depuis app/front/, qui n'est PAS dans public/ :
 * rien n'est lisible sans compte. Le pare-feu (access_control) protège chaque route ci-dessous.
 */
final class FrontController extends AbstractController
{
    private const TYPES = [
        'js' => 'text/javascript; charset=UTF-8',
        'css' => 'text/css; charset=UTF-8',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'webp' => 'image/webp',
        'woff2' => 'font/woff2',
    ];

    public function __construct(#[Autowire('%kernel.project_dir%/front')] private readonly string $racine, private readonly Packages $assets, #[Autowire(service: 'security.logout_url_generator')] private readonly LogoutUrlGenerator $deconnexion)
    {
    }

    #[Route('/', name: 'app_accueil', methods: ['GET'])]
    public function accueil(): Response
    {
        $fichier = $this->racine.'/index.html';
        if (!is_file($fichier)) {
            throw new NotFoundHttpException();
        }
        // La feuille Tailwind de la vue porte un nom empreinté (AssetMapper) : la page l'y référence au service.
        $html = str_replace(
            ['<!--VUE_CSS-->', '<!--LOGOUT-->', '<!--FAVICON-->'],
            ['<link rel="stylesheet" href="'.$this->assets->getUrl('styles/vue.css').'">', htmlspecialchars($this->deconnexion->getLogoutPath(), \ENT_QUOTES), $this->assets->getUrl('favicon.svg')],
            (string) file_get_contents($fichier),
        );

        return new Response($html, 200, ['Content-Type' => 'text/html; charset=UTF-8', 'Cache-Control' => 'private, no-cache', 'X-Content-Type-Options' => 'nosniff']);
    }

    #[Route('/{dossier}/{chemin}', name: 'app_front', requirements: ['dossier' => 'src|vendor', 'chemin' => '.+'], methods: ['GET'], priority: -10)]
    public function ressource(string $dossier, string $chemin): Response
    {
        $fichier = realpath($this->racine.'/'.$dossier.'/'.$chemin);
        $base = realpath($this->racine.'/'.$dossier);
        $ext = $fichier === false ? '' : strtolower(pathinfo($fichier, \PATHINFO_EXTENSION));

        if ($fichier === false || $base === false || !str_starts_with($fichier, $base.\DIRECTORY_SEPARATOR) || !isset(self::TYPES[$ext])) {
            throw new NotFoundHttpException();
        }

        return $this->servir($fichier, self::TYPES[$ext]);
    }

    private function servir(string $fichier, string $type): Response
    {
        if (!is_file($fichier)) {
            throw new NotFoundHttpException();
        }
        $reponse = new BinaryFileResponse($fichier, 200, ['Content-Type' => $type], false);
        // Contenu réservé aux comptes connectés : jamais dans un cache partagé.
        $reponse->headers->set('Cache-Control', 'private, no-cache');
        $reponse->headers->set('X-Content-Type-Options', 'nosniff');

        return $reponse;
    }
}
