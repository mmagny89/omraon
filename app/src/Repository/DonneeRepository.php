<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\Donnee;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/** @extends ServiceEntityRepository<Donnee> */
class DonneeRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Donnee::class);
    }

    /** @return array<string, Donnee> surcharges d'un jeu, indexées par section */
    public function parJeu(string $jeu): array
    {
        $out = [];
        foreach ($this->findBy(['jeu' => $jeu]) as $d) {
            $out[$d->getSection()] = $d;
        }

        return $out;
    }
}
