<?php

declare(strict_types=1);

namespace App\Command;

use App\Entity\User;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Argument;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Style\SymfonyStyle;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

#[AsCommand(name: 'app:utilisateur:creer', description: 'Crée un compte (le premier admin se crée ici : pas d\'inscription autonome).')]
final readonly class CreerUtilisateurCommand
{
    public function __construct(
        private UserRepository $users,
        private EntityManagerInterface $em,
        private UserPasswordHasherInterface $hasher,
    ) {
    }

    public function __invoke(
        SymfonyStyle $io,
        #[Argument('Email (identifiant)')] string $email,
        #[Argument('Nom affiché')] string $nom,
        #[Option('Rôle administrateur')] bool $admin = false,
    ): int {
        $user = (new User())->setEmail($email)->setNom($nom)->setAdmin($admin);
        if ($this->users->findOneBy(['email' => $user->getEmail()]) !== null) {
            $io->error('Un compte existe déjà avec cet email.');

            return Command::FAILURE;
        }
        $mdp = (string) $io->askHidden('Mot de passe (12 caractères minimum)');
        if (mb_strlen($mdp) < 12) {
            $io->error('Mot de passe trop court.');

            return Command::FAILURE;
        }
        $user->setPassword($this->hasher->hashPassword($user, $mdp));
        $this->em->persist($user);
        $this->em->flush();
        $io->success(sprintf('Compte %s créé (%s).', $user->getEmail(), $admin ? 'admin' : 'lecteur'));

        return Command::SUCCESS;
    }
}
