<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\User;
use App\Service\IllustrationService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

final class IllustrationController extends AbstractController
{
    private const REQ = ['type' => 'astre|site|personnage', 'cle' => '[a-z0-9-]+'];

    public function __construct(private readonly IllustrationService $illustrations)
    {
    }

    #[Route('/illustrations/{type}/{cle}', name: 'illustration', requirements: self::REQ, methods: ['GET'])]
    public function voir(string $type, string $cle, Request $requete): Response
    {
        return $this->illustrations->reponse($type, $cle, $requete) ?? throw new NotFoundHttpException();
    }

    #[Route('/admin/illustrations/{type}/{cle}', name: 'admin_illustration_televerser', requirements: self::REQ, methods: ['POST'])]
    #[IsGranted(User::ROLE_ADMIN)]
    public function televerser(string $type, string $cle, Request $requete): RedirectResponse
    {
        $this->verifier($type, $cle, $requete, 'illustration'.$type.$cle);
        $erreur = $this->illustrations->enregistrer($type, $cle, $requete->files->get('image'), $this->getUser()?->getUserIdentifier() ?? '?');
        $this->addFlash($erreur === null ? 'succes' : 'erreur', $erreur ?? 'Illustration enregistrée.');

        return $this->retour($requete);
    }

    #[Route('/admin/illustrations/{type}/{cle}/supprimer', name: 'admin_illustration_supprimer', requirements: self::REQ, methods: ['POST'])]
    #[IsGranted(User::ROLE_ADMIN)]
    public function supprimer(string $type, string $cle, Request $requete): RedirectResponse
    {
        $this->verifier($type, $cle, $requete, 'illustration'.$type.$cle);
        $this->illustrations->supprimer($type, $cle);
        $this->addFlash('succes', 'Illustration téléversée retirée : l\'illustration générée reprend sa place.');

        return $this->retour($requete);
    }

    private function verifier(string $type, string $cle, Request $requete, string $jeton): void
    {
        if (!$this->isCsrfTokenValid($jeton, (string) $requete->request->get('_token'))) {
            throw $this->createAccessDeniedException();
        }
        if (!$this->illustrations->existe($type, $cle)) {
            throw new NotFoundHttpException();
        }
    }

    /** Retour à la page d'où vient la demande, si elle appartient au site. */
    private function retour(Request $requete): RedirectResponse
    {
        $origine = (string) $requete->headers->get('referer');
        $hote = $requete->getSchemeAndHttpHost();

        return new RedirectResponse(str_starts_with($origine, $hote.'/') ? $origine : $this->generateUrl('app_accueil'));
    }
}
