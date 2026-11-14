<?php

declare(strict_types=1);

namespace App\Controller\Admin;

use App\Entity\User;
use App\Form\UtilisateurType;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/admin/utilisateurs')]
#[IsGranted(User::ROLE_ADMIN)]
final class UtilisateurController extends AbstractController
{
    public function __construct(
        private readonly UserRepository $users,
        private readonly EntityManagerInterface $em,
        private readonly UserPasswordHasherInterface $hasher,
    ) {
    }

    #[Route('', name: 'admin_utilisateurs', methods: ['GET'])]
    public function index(): Response
    {
        return $this->render('admin/utilisateurs/index.html.twig', ['utilisateurs' => $this->users->tousParNom()]);
    }

    #[Route('/nouveau', name: 'admin_utilisateur_nouveau', methods: ['GET', 'POST'])]
    public function nouveau(Request $request): Response
    {
        $user = new User();
        $form = $this->createForm(UtilisateurType::class, $user, ['creation' => true]);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $user->setPassword($this->hasher->hashPassword($user, (string) $form->get('motDePasse')->getData()));
            $user->setAdmin((bool) $form->get('admin')->getData());
            $this->em->persist($user);
            $this->em->flush();
            $this->addFlash('succes', 'Compte créé.');

            return $this->redirectToRoute('admin_utilisateurs');
        }

        return $this->render('admin/utilisateurs/form.html.twig', ['form' => $form, 'titre' => 'Nouveau compte']);
    }

    #[Route('/{id}/modifier', name: 'admin_utilisateur_modifier', requirements: ['id' => '\d+'], methods: ['GET', 'POST'])]
    public function modifier(User $user, Request $request): Response
    {
        $form = $this->createForm(UtilisateurType::class, $user);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            $admin = (bool) $form->get('admin')->getData();
            $actif = $user->isActif();
            $dernierAdmin = $user->estAdmin() && $this->users->compterAdminsActifs() <= 1;
            if ($dernierAdmin && (!$admin || !$actif)) {
                $this->addFlash('erreur', 'Impossible : c\'est le dernier administrateur actif.');

                return $this->redirectToRoute('admin_utilisateur_modifier', ['id' => $user->getId()]);
            }
            $user->setAdmin($admin);
            $mdp = (string) $form->get('motDePasse')->getData();
            if ($mdp !== '') {
                $user->setPassword($this->hasher->hashPassword($user, $mdp));
            }
            $this->em->flush();
            $this->addFlash('succes', 'Compte mis à jour.');

            return $this->redirectToRoute('admin_utilisateurs');
        }

        return $this->render('admin/utilisateurs/form.html.twig', ['form' => $form, 'titre' => 'Modifier '.$user->getNom()]);
    }

    #[Route('/{id}/supprimer', name: 'admin_utilisateur_supprimer', requirements: ['id' => '\d+'], methods: ['POST'])]
    public function supprimer(User $user, Request $request): Response
    {
        if (!$this->isCsrfTokenValid('supprimer'.$user->getId(), (string) $request->request->get('_token'))) {
            throw $this->createAccessDeniedException();
        }
        if ($user === $this->getUser()) {
            $this->addFlash('erreur', 'Vous ne pouvez pas supprimer votre propre compte.');
        } elseif ($user->estAdmin() && $user->isActif() && $this->users->compterAdminsActifs() <= 1) {
            $this->addFlash('erreur', 'Impossible : c\'est le dernier administrateur actif.');
        } else {
            $this->em->remove($user);
            $this->em->flush();
            $this->addFlash('succes', 'Compte supprimé.');
        }

        return $this->redirectToRoute('admin_utilisateurs');
    }
}
