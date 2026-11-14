<?php

declare(strict_types=1);

namespace App\Entity;

use App\Repository\IllustrationRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;

/**
 * Illustration téléversée par un admin pour un astre, un site ou un personnage. Sans ligne ici, la page sert l'illustration
 * générée (SVG calculé depuis les données). Le contenu est en base : aucun volume de fichiers à sauvegarder.
 */
#[ORM\Entity(repositoryClass: IllustrationRepository::class)]
#[ORM\Table(name: 'illustration')]
#[ORM\UniqueConstraint(name: 'uniq_illustration_type_cle', columns: ['type', 'cle'])]
class Illustration
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 16)]
    private string $type;

    #[ORM\Column(length: 64)]
    private string $cle;

    #[ORM\Column(length: 32)]
    private string $mime;

    /** @var resource|string */
    #[ORM\Column(type: Types::BLOB)]
    private $contenu;

    #[ORM\Column]
    private int $taille;

    #[ORM\Column(length: 180)]
    private string $modifiePar;

    #[ORM\Column]
    private \DateTimeImmutable $modifieLe;

    public function __construct(string $type, string $cle, string $mime, string $contenu, string $modifiePar)
    {
        $this->type = $type;
        $this->cle = $cle;
        $this->remplacer($mime, $contenu, $modifiePar);
    }

    public function remplacer(string $mime, string $contenu, string $modifiePar): void
    {
        $this->mime = $mime;
        $this->contenu = $contenu;
        $this->taille = \strlen($contenu);
        $this->modifiePar = $modifiePar;
        $this->modifieLe = new \DateTimeImmutable();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getType(): string
    {
        return $this->type;
    }

    public function getCle(): string
    {
        return $this->cle;
    }

    public function getMime(): string
    {
        return $this->mime;
    }

    public function getContenu(): string
    {
        return \is_resource($this->contenu) ? (string) stream_get_contents($this->contenu, -1, 0) : (string) $this->contenu;
    }

    public function getTaille(): int
    {
        return $this->taille;
    }

    public function getModifiePar(): string
    {
        return $this->modifiePar;
    }

    public function getModifieLe(): \DateTimeImmutable
    {
        return $this->modifieLe;
    }
}
