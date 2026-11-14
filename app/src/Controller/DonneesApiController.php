<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\DonneesService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;

/** Données du système pour la vue : réservé aux comptes connectés (access_control, ^/ → ROLE_LECTEUR). */
final class DonneesApiController extends AbstractController
{
    #[Route('/api/donnees/{jeu}', name: 'api_donnees', requirements: ['jeu' => 'systeme|sites|economie'], methods: ['GET'])]
    public function jeu(string $jeu, DonneesService $donnees): JsonResponse
    {
        $reponse = new JsonResponse(null, 200, ['X-Content-Type-Options' => 'nosniff']);
        $reponse->setEncodingOptions(\JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES | \JSON_PRESERVE_ZERO_FRACTION);
        $reponse->setData($donnees->jeu($jeu));
        $reponse->headers->set('Cache-Control', 'private, no-store');

        return $reponse;
    }
}
