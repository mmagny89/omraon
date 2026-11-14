<?php

declare(strict_types=1);

namespace App\Controller;

use App\Service\FichesService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\Routing\Attribute\Route;

/** Pages de détail, lisibles par tout compte connecté (access_control ^/ → ROLE_LECTEUR). */
final class FichesController extends AbstractController
{
    private const ID = '[a-z0-9-]+';

    public function __construct(private readonly FichesService $fiches)
    {
    }

    #[Route('/astres', name: 'fiches_astres', methods: ['GET'])]
    public function astres(): Response
    {
        return $this->render('fiches/astres.html.twig', ['astres' => $this->fiches->astres()]);
    }

    #[Route('/astres/{id}', name: 'fiches_astre', requirements: ['id' => self::ID], methods: ['GET'])]
    public function astre(string $id): Response
    {
        return $this->render('fiches/astre.html.twig', ['id' => $id, 'a' => $this->ou404($this->fiches->astre($id))]);
    }

    #[Route('/sites', name: 'fiches_sites', methods: ['GET'])]
    public function sites(): Response
    {
        $sites = $this->fiches->sites();

        return $this->render('fiches/sites.html.twig', ['sites' => $sites, 'corps' => array_values(array_unique(array_map(static fn ($s) => $s->body, $sites)))]);
    }

    #[Route('/sites/{id}', name: 'fiches_site', requirements: ['id' => self::ID], methods: ['GET'])]
    public function site(string $id): Response
    {
        return $this->render('fiches/site.html.twig', ['f' => $this->ou404($this->fiches->site($id))]);
    }

    #[Route('/personnages', name: 'fiches_personnages', methods: ['GET'])]
    public function personnages(): Response
    {
        return $this->render('fiches/personnages.html.twig', ['personnages' => $this->fiches->personnages(), 'vestiges' => $this->fiches->vestiges()]);
    }

    #[Route('/personnages/{id}', name: 'fiches_personnage', requirements: ['id' => self::ID], methods: ['GET'])]
    public function personnage(string $id): Response
    {
        return $this->render('fiches/personnage.html.twig', ['f' => $this->ou404($this->fiches->personnage($id))]);
    }

    #[Route('/scenes', name: 'fiches_scenes', methods: ['GET'])]
    public function scenes(): Response
    {
        $sites = $this->fiches->sites();

        return $this->render('fiches/scenes.html.twig', ['sites' => $sites, 'corps' => array_values(array_unique(array_map(static fn ($s) => $s->body, $sites)))]);
    }

    #[Route('/scenes/{id}', name: 'fiches_scene', requirements: ['id' => self::ID], methods: ['GET'])]
    public function scene(string $id): Response
    {
        return $this->render('fiches/scene.html.twig', ['s' => $this->ou404($this->fiches->scene($id))]);
    }

    #[Route('/lexique', name: 'fiches_lexique', methods: ['GET'])]
    public function lexique(): Response
    {
        return $this->render('fiches/lexique.html.twig', $this->fiches->lexique());
    }

    #[Route('/chronologie', name: 'fiches_chronologie', methods: ['GET'])]
    public function chronologie(): Response
    {
        return $this->render('fiches/chronologie.html.twig', $this->fiches->chronologie());
    }

    /**
     * @template T
     *
     * @param T|null $valeur
     *
     * @return T
     */
    private function ou404(mixed $valeur): mixed
    {
        return $valeur ?? throw new NotFoundHttpException();
    }
}
