<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\PasswordUpgraderInterface;

/** @extends ServiceEntityRepository<User> */
class UserRepository extends ServiceEntityRepository implements PasswordUpgraderInterface
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, User::class);
    }

    public function upgradePassword(PasswordAuthenticatedUserInterface $user, string $newHashedPassword): void
    {
        if (!$user instanceof User) {
            return;
        }
        $user->setPassword($newHashedPassword);
        $this->getEntityManager()->flush();
    }

    /** @return list<User> */
    public function tousParNom(): array
    {
        return $this->findBy([], ['nom' => 'ASC']);
    }

    public function compterAdminsActifs(): int
    {
        $n = 0;
        foreach ($this->findBy(['actif' => true]) as $u) {
            if ($u->estAdmin()) {
                ++$n;
            }
        }

        return $n;
    }
}
