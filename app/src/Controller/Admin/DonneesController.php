<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Entity\User;
use App\Service\DonneesService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin/donnees')]
#[IsGranted(User::ROLE_ADMIN)]
final class DonneesController extends AbstractController
{
    private const JSON_JOLI = \JSON_PRETTY_PRINT | \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES | \JSON_PRESERVE_ZERO_FRACTION;

    public function __construct(private readonly DonneesService $donnees)
    {
    }

    #[Route('', name: 'admin_donnees', methods: ['GET'])]
    public function index(): Response
    {
        $jeux = [];
        foreach (DonneesService::JEUX as $cle => $libelle) {
            $sections = [];
            foreach ($this->donnees->sections($cle) as $section) {
                $sections[] = ['nom' => $section, 'surcharge' => $this->donnees->surcharge($cle, $section)];
            }
            $jeux[] = ['cle' => $cle, 'libelle' => $libelle, 'sections' => $sections];
        }

        return $this->render('admin/donnees/index.html.twig', ['jeux' => $jeux]);
    }

    #[Route('/{jeu}/{section}', name: 'admin_donnees_modifier', requirements: ['jeu' => DonneesService::JEUX_REGEX, 'section' => '[A-Z_]+'], methods: ['GET', 'POST'])]
    public function modifier(string $jeu, string $section, Request $request): Response
    {
        if (!\in_array($section, $this->donnees->sections($jeu), true)) {
            throw new NotFoundHttpException();
        }
        $texte = json_encode($this->donnees->section($jeu, $section), self::JSON_JOLI);
        $erreur = null;

        if ($request->isMethod('POST')) {
            if (!$this->isCsrfTokenValid('donnees'.$jeu.$section, (string) $request->request->get('_token'))) {
                throw $this->createAccessDeniedException();
            }
            $texte = (string) $request->request->get('valeur');
            $erreur = $this->donnees->valider($jeu, $section, $texte);
            if ($erreur === null) {
                $this->donnees->enregistrer($jeu, $section, $texte, $this->getUser()?->getUserIdentifier() ?? '?');
                $this->addFlash('succes', sprintf('« %s » enregistrée : elle devient la valeur par défaut de tous les comptes.', $section));

                return $this->redirectToRoute('admin_donnees');
            }
        }

        return $this->render('admin/donnees/form.html.twig', [
            'jeu' => $jeu, 'section' => $section, 'texte' => $texte, 'erreur' => $erreur,
            'surcharge' => $this->donnees->surcharge($jeu, $section),
        ]);
    }

    #[Route('/{jeu}/{section}/reinitialiser', name: 'admin_donnees_reinitialiser', requirements: ['jeu' => DonneesService::JEUX_REGEX, 'section' => '[A-Z_]+'], methods: ['POST'])]
    public function reinitialiser(string $jeu, string $section, Request $request): Response
    {
        if (!$this->isCsrfTokenValid('reinit'.$jeu.$section, (string) $request->request->get('_token'))) {
            throw $this->createAccessDeniedException();
        }
        if (!\in_array($section, $this->donnees->sections($jeu), true)) {
            throw new NotFoundHttpException();
        }
        $this->donnees->reinitialiser($jeu, $section);
        $this->addFlash('succes', sprintf('« %s » remise à la valeur du canon.', $section));

        return $this->redirectToRoute('admin_donnees');
    }
}
