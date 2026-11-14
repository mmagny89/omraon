<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\DonneeRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Surcharge d'une section du canon (app/donnees/canon/<jeu>.json) par un admin.
 * Sans ligne ici, la section garde la valeur du canon ; supprimer la ligne la réinitialise.
 */
#[ORM\Entity(repositoryClass: DonneeRepository::class)]
#[ORM\Table(name: 'donnee')]
#[ORM\UniqueConstraint(name: 'uniq_donnee_jeu_section', columns: ['jeu', 'section'])]
class Donnee
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 32)]
    private string $jeu;

    #[ORM\Column(length: 64)]
    private string $section;

    /** JSON brut : un objet vide {} survit tel quel (une colonne JSON Doctrine le rendrait []). */
    #[ORM\Column(type: Types::TEXT)]
    private string $valeur;

    #[ORM\Column]
    private \DateTimeImmutable $modifieLe;

    #[ORM\Column(length: 180)]
    private string $modifiePar;

    public function __construct(string $jeu, string $section, string $valeur, string $modifiePar)
    {
        $this->jeu = $jeu;
        $this->section = $section;
        $this->valeur = $valeur;
        $this->modifiePar = $modifiePar;
        $this->modifieLe = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getJeu(): string
    {
        return $this->jeu;
    }

    public function getSection(): string
    {
        return $this->section;
    }

    public function getValeur(): string
    {
        return $this->valeur;
    }

    public function remplacer(string $valeur, string $modifiePar): void
    {
        $this->valeur = $valeur;
        $this->modifiePar = $modifiePar;
        $this->modifieLe = new \DateTimeImmutable();
    }

    public function getModifieLe(): \DateTimeImmutable
    {
        return $this->modifieLe;
    }

    public function getModifiePar(): string
    {
        return $this->modifiePar;
    }
}
