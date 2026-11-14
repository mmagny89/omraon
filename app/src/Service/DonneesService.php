<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Donnee;
use App\Repository\DonneeRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\DependencyInjection\Attribute\Autowire;

/**
 * Valeurs par défaut du système : canon (fichiers JSON versionnés) + surcharges des admins (base).
 * Les objets JSON restent des stdClass de bout en bout : un {} ne devient jamais [].
 */
final class DonneesService
{
    public const JEUX = [
        'systeme' => 'Système (étoile, planètes, lunes, ceintures)',
        'sites' => 'Sites (cités, stations, bases)',
        'economie' => 'Économie',
        'lore' => 'Lore (calendrier, personnages, vestiges)',
        'glossaire' => 'Lexique tyt',
        'ambiances' => 'Ambiances des scènes',
        'chronologie' => 'Chronologie (ères, événements)',
    ];
    /** Valeur de `requirements` des routes : les clés de JEUX. */
    public const JEUX_REGEX = 'systeme|sites|economie|lore|glossaire|ambiances|chronologie';
    private const TAILLE_MAX = 524288;

    /** @var array<string, array{mtime: int, valeur: \stdClass}> */
    private array $canons = [];

    public function __construct(
        #[Autowire('%kernel.project_dir%/donnees/canon')] private readonly string $dossier,
        private readonly DonneeRepository $repo,
        private readonly EntityManagerInterface $em,
    ) {
    }

    public function jeuExiste(string $jeu): bool
    {
        return isset(self::JEUX[$jeu]);
    }

    /** @return list<string> */
    public function sections(string $jeu): array
    {
        return array_keys(get_object_vars($this->canon($jeu)));
    }

    public function canonSection(string $jeu, string $section): mixed
    {
        return $this->canon($jeu)->{$section} ?? null;
    }

    /** Jeu complet tel que le reçoit le front : canon, section par section remplacé par la surcharge. */
    public function jeu(string $jeu): \stdClass
    {
        $out = clone $this->canon($jeu);
        foreach ($this->repo->parJeu($jeu) as $section => $d) {
            if (property_exists($out, $section)) {
                $out->{$section} = json_decode($d->getValeur(), false, 64, \JSON_THROW_ON_ERROR);
            }
        }

        return $out;
    }

    public function section(string $jeu, string $section): mixed
    {
        return $this->jeu($jeu)->{$section} ?? null;
    }

    /**
     * Sections dont la valeur par défaut a été modifiée par un admin : { jeu: { section: { par, le } } }.
     *
     * @return array<string, array<string, array{par: string, le: string}>>
     */
    public function modifications(bool $montrerAuteur = false): array
    {
        $out = [];
        foreach (array_keys(self::JEUX) as $jeu) {
            foreach ($this->repo->parJeu($jeu) as $section => $d) {
                $out[$jeu][$section] = ['par' => $montrerAuteur ? $d->getModifiePar() : 'un administrateur', 'le' => $d->getModifieLe()->format('c')];
            }
        }

        return $out;
    }

    public function estModifiee(string $jeu, string $section): bool
    {
        return isset($this->repo->parJeu($jeu)[$section]);
    }

    public function surcharge(string $jeu, string $section): ?Donnee
    {
        return $this->repo->parJeu($jeu)[$section] ?? null;
    }

    /**
     * @return string|null message d'erreur, ou null si le texte est valide
     */
    public function valider(string $jeu, string $section, string $json): ?string
    {
        if (\strlen($json) > self::TAILLE_MAX) {
            return 'Trop volumineux (512 Ko maximum).';
        }
        try {
            $valeur = json_decode($json, false, 32, \JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            return 'JSON invalide : '.$e->getMessage();
        }
        if (($balise = $this->baliseDans($valeur)) !== null) {
            return sprintf('Le texte « %s » contient une balise HTML : refusé (les fiches s\'affichent sans mise en forme HTML).', mb_strimwidth($balise, 0, 60, '…'));
        }
        $canon = $this->canonSection($jeu, $section);
        if (\gettype($valeur) !== \gettype($canon) && !(\is_int($valeur) && \is_float($canon)) && !(\is_float($valeur) && \is_int($canon))) {
            return sprintf('Type attendu : %s (reçu : %s).', get_debug_type($canon), get_debug_type($valeur));
        }
        if (\is_array($canon) && \is_array($valeur) && isset($canon[0]) && \is_object($canon[0]) && property_exists($canon[0], 'id')) {
            $ids = [];
            foreach ($valeur as $i => $element) {
                if (!\is_object($element) || !isset($element->id) || !\is_string($element->id) || $element->id === '') {
                    return sprintf('Élément %d : un « id » texte est obligatoire.', $i + 1);
                }
                if (isset($ids[$element->id])) {
                    return sprintf('Identifiant en double : %s.', $element->id);
                }
                $ids[$element->id] = true;
            }
            if ($valeur === []) {
                return 'La liste ne peut pas être vide.';
            }
        }

        return null;
    }

    public function enregistrer(string $jeu, string $section, string $json, string $par): void
    {
        $normalise = json_encode(json_decode($json, false, 32, \JSON_THROW_ON_ERROR), \JSON_UNESCAPED_UNICODE | \JSON_UNESCAPED_SLASHES | \JSON_PRESERVE_ZERO_FRACTION | \JSON_THROW_ON_ERROR);
        $existante = $this->surcharge($jeu, $section);
        if ($existante instanceof Donnee) {
            $existante->remplacer($normalise, $par);
        } else {
            $this->em->persist(new Donnee($jeu, $section, $normalise, $par));
        }
        $this->em->flush();
    }

    public function reinitialiser(string $jeu, string $section): void
    {
        $d = $this->surcharge($jeu, $section);
        if ($d instanceof Donnee) {
            $this->em->remove($d);
            $this->em->flush();
        }
    }

    /** Premier texte qui ressemble à une balise HTML (`<a`, `</`, `<!`) : la vue construit des fiches en HTML, un texte saisi ne doit jamais y injecter de balise. */
    private function baliseDans(mixed $v): ?string
    {
        if (\is_string($v)) {
            return preg_match('/<[a-zA-Z\/!?]/', $v) === 1 ? $v : null;
        }
        if (\is_array($v) || \is_object($v)) {
            foreach ((array) $v as $x) {
                if (($t = $this->baliseDans($x)) !== null) {
                    return $t;
                }
            }
        }

        return null;
    }

    private function canon(string $jeu): \stdClass
    {
        if (!$this->jeuExiste($jeu)) {
            throw new \InvalidArgumentException('Jeu inconnu : '.$jeu);
        }

        // Le worker FrankenPHP garde le service en mémoire d'une requête à l'autre : la date du fichier invalide le cache
        // quand le canon change (sans cela, un fichier modifié n'est vu qu'au redémarrage).
        $fichier = $this->dossier.'/'.$jeu.'.json';
        clearstatcache(true, $fichier);
        $mtime = (int) filemtime($fichier);
        if (($this->canons[$jeu]['mtime'] ?? null) !== $mtime) {
            $this->canons[$jeu] = ['mtime' => $mtime, 'valeur' => json_decode((string) file_get_contents($fichier), false, 64, \JSON_THROW_ON_ERROR)];
        }

        return $this->canons[$jeu]['valeur'];
    }
}
