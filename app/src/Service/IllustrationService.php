<?php

declare(strict_types=1);

namespace App\Service;

use App\Entity\Illustration;
use App\Repository\IllustrationRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Illustrations des astres, sites et personnages : SVG généré depuis les données du canon, ou image téléversée par un admin
 * (PNG, JPEG, WebP seulement : jamais de SVG téléversé, qui pourrait porter du script). Toute la logique est ici.
 */
final readonly class IllustrationService
{
    public const TYPES = ['astre', 'site', 'personnage'];
    private const MIMES = [\IMAGETYPE_PNG => 'image/png', \IMAGETYPE_JPEG => 'image/jpeg', \IMAGETYPE_WEBP => 'image/webp'];
    public const TAILLE_MAX = 2 * 1024 * 1024;
    private const PIXELS_MAX = 16_000_000;

    public function __construct(
        private FichesService $fiches,
        private IllustrationRepository $repo,
        private EntityManagerInterface $em,
    ) {
    }

    public function reponse(string $type, string $cle, Request $requete): ?Response
    {
        $image = $this->repo->trouver($type, $cle);
        if ($image instanceof Illustration) {
            $contenu = $image->getContenu();
            $mime = $image->getMime();
        } else {
            $contenu = $this->generer($type, $cle);
            $mime = 'image/svg+xml';
            if ($contenu === null) {
                return null;
            }
        }
        $r = new Response($contenu, 200, [
            'Content-Type' => $mime,
            'X-Content-Type-Options' => 'nosniff',
            // Une image n'a aucune raison d'exécuter quoi que ce soit : tout est interdit hors son propre rendu.
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            'Cache-Control' => 'private, no-cache',
        ]);
        $r->setEtag(md5($contenu));
        $r->isNotModified($requete);

        return $r;
    }

    public function estTeleversee(string $type, string $cle): bool
    {
        return $this->repo->trouver($type, $cle) instanceof Illustration;
    }

    public function details(string $type, string $cle): ?Illustration
    {
        return $this->repo->trouver($type, $cle);
    }

    /** @return string|null message d'erreur, ou null si l'image est enregistrée */
    public function enregistrer(string $type, string $cle, ?UploadedFile $fichier, string $par): ?string
    {
        if (!$fichier instanceof UploadedFile || !$fichier->isValid()) {
            return 'Aucun fichier reçu (ou téléversement interrompu).';
        }
        if ($fichier->getSize() > self::TAILLE_MAX) {
            return 'Image trop lourde (2 Mo maximum).';
        }
        $octets = (string) file_get_contents($fichier->getPathname());
        $info = @getimagesizefromstring($octets);
        if ($info === false || !isset(self::MIMES[$info[2]])) {
            return 'Format refusé : PNG, JPEG ou WebP uniquement.';
        }
        if ($info[0] < 1 || $info[1] < 1 || $info[0] * $info[1] > self::PIXELS_MAX) {
            return 'Dimensions refusées (16 millions de pixels au plus).';
        }
        $existante = $this->repo->trouver($type, $cle);
        if ($existante instanceof Illustration) {
            $existante->remplacer(self::MIMES[$info[2]], $octets, $par);
        } else {
            $this->em->persist(new Illustration($type, $cle, self::MIMES[$info[2]], $octets, $par));
        }
        $this->em->flush();

        return null;
    }

    public function supprimer(string $type, string $cle): void
    {
        $i = $this->repo->trouver($type, $cle);
        if ($i instanceof Illustration) {
            $this->em->remove($i);
            $this->em->flush();
        }
    }

    public function existe(string $type, string $cle): bool
    {
        return $this->generer($type, $cle) !== null;
    }

    private function generer(string $type, string $cle): ?string
    {
        return match ($type) {
            'astre' => $this->astre($cle),
            'site' => $this->site($cle),
            'personnage' => $this->personnage($cle),
            default => null,
        };
    }

    // ---------------------------------------------------------------- astres

    private function astre(string $id): ?string
    {
        $a = $this->fiches->astre($id);
        if ($a === null) {
            return null;
        }
        /** @var \stdClass $d */
        $d = $a['donnees'];
        $couleur = $this->hex($d->color ?? '#8d9bb8');
        $type = (string) $a['type'];
        $svg = '';
        $defs = '';

        if (str_starts_with($type, 'Ceinture')) {
            $froide = $type === 'Ceinture froide';
            for ($k = 0; $k < 70; ++$k) {
                $ang = $this->alea($id, $k, 1) * 2 * \M_PI;
                $r = 30 + $this->alea($id, $k, 2) * 14;
                $x = 50 + $r * cos($ang);
                $y = 50 + 0.55 * $r * sin($ang);
                $t = 0.8 + $this->alea($id, $k, 3) * 2.2;
                $svg .= sprintf('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" opacity="%.2f"/>', $x, $y, $t, $froide ? '#bcd6ee' : '#c8c8d0', 0.4 + $this->alea($id, $k, 4) * 0.6);
            }

            return $this->enveloppe($svg, $defs);
        }

        $etoile = str_starts_with($type, 'Étoile');
        $r = $etoile ? 24 : (str_starts_with($type, 'Lune') ? 28 : 33);
        if ($etoile) {
            $defs .= sprintf('<radialGradient id="halo"><stop offset="0.3" stop-color="%s" stop-opacity="0.9"/><stop offset="1" stop-color="%s" stop-opacity="0"/></radialGradient>', $couleur, $couleur);
            $svg .= '<circle cx="50" cy="50" r="48" fill="url(#halo)"/>';
        }
        $defs .= sprintf(
            '<radialGradient id="corps" cx="0.35" cy="0.3" r="0.9"><stop offset="0" stop-color="%s"/><stop offset="0.5" stop-color="%s"/><stop offset="1" stop-color="%s"/></radialGradient><clipPath id="disque"><circle cx="50" cy="50" r="%d"/></clipPath>',
            $this->melange($couleur, '#ffffff', $etoile ? 0.7 : 0.3), $couleur, $this->melange($couleur, '#000000', $etoile ? 0.1 : 0.7), $r,
        );
        $anneaux = isset($d->rings);
        if ($anneaux) {
            $svg .= sprintf('<path d="M 4 50 A 46 12 0 0 1 96 50" fill="none" stroke="%s" stroke-width="3" opacity="0.45" transform="rotate(-18 50 50)"/>', $this->melange($couleur, '#ffffff', 0.5));
        }
        $svg .= sprintf('<circle cx="50" cy="50" r="%d" fill="url(#corps)"/>', $r);
        if (($d->kind ?? '') === 'gas') {
            $bandes = '';
            for ($k = 0; $k < 6; ++$k) {
                $bandes .= sprintf('<rect x="0" y="%.1f" width="100" height="%.1f" fill="%s" opacity="%.2f"/>', 50 - $r + $k * ($r / 3), 2 + $this->alea($id, $k, 5) * 5, $this->melange($couleur, $k % 2 ? '#000000' : '#ffffff', 0.35), 0.25 + $this->alea($id, $k, 6) * 0.3);
            }
            $svg .= '<g clip-path="url(#disque)">'.$bandes.'</g>';
        } elseif (!$etoile) {
            for ($k = 0; $k < 5; ++$k) {
                $svg .= sprintf('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" opacity="0.18" clip-path="url(#disque)"/>', 50 - $r + $this->alea($id, $k, 7) * 2 * $r, 50 - $r + $this->alea($id, $k, 8) * 2 * $r, 3 + $this->alea($id, $k, 9) * 8, $this->melange($couleur, '#000000', 0.6));
            }
        }
        if (isset($d->atmosphere->color)) {
            $svg .= sprintf('<circle cx="50" cy="50" r="%d" fill="none" stroke="%s" stroke-width="2.5" opacity="0.4"/>', $r + 2, $this->hex($d->atmosphere->color));
        }
        if (!$etoile) { // terminateur : le côté nuit
            $svg .= sprintf('<circle cx="50" cy="50" r="%d" fill="url(#nuit)" clip-path="url(#disque)"/>', $r);
            $defs .= '<radialGradient id="nuit" cx="0.3" cy="0.3" r="1"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.6"/></radialGradient>';
        }
        if ($anneaux) {
            $svg .= sprintf('<path d="M 4 50 A 46 12 0 0 0 96 50" fill="none" stroke="%s" stroke-width="3" opacity="0.6" transform="rotate(-18 50 50)"/>', $this->melange($couleur, '#ffffff', 0.5));
        }

        return $this->enveloppe($svg, $defs);
    }

    // ---------------------------------------------------------------- sites

    private function site(string $id): ?string
    {
        $s = null;
        foreach ($this->fiches->sites() as $x) {
            if ($x->id === $id) {
                $s = $x;
            }
        }
        if ($s === null) {
            return null;
        }
        $couleur = '#8d9bb8';
        foreach ($this->fiches->astres() as $a) {
            if ($a['nom'] === $s->body && $a['couleur']) {
                $couleur = $this->hex($a['couleur']);
            }
        }
        $fond = $this->melange($couleur, '#04060d', 0.8);
        $trait = '#ffe2b0';
        $forme = '';
        $sol = sprintf('<path d="M0 72 Q50 64 100 72 V100 H0Z" fill="%s"/>', $this->melange($couleur, '#000000', 0.45));

        switch ($s->type) {
            case 'orbit':
                $forme = sprintf('<circle cx="50" cy="50" r="30" fill="%s" opacity="0.5"/>', $couleur)
                    .sprintf('<g fill="%1$s"><rect x="40" y="38" width="20" height="24" rx="3"/><rect x="8" y="46" width="28" height="8" rx="1" opacity="0.8"/><rect x="64" y="46" width="28" height="8" rx="1" opacity="0.8"/><circle cx="50" cy="50" r="6" fill="#04060d"/></g>', $trait);
                $sol = '';
                break;
            case 'floating':
                $forme = sprintf('<ellipse cx="50" cy="66" rx="38" ry="9" fill="%s" opacity="0.5"/><ellipse cx="34" cy="70" rx="22" ry="7" fill="%s" opacity="0.4"/>', $couleur, $couleur)
                    .sprintf('<g fill="%s"><rect x="30" y="46" width="40" height="8" rx="2"/><rect x="38" y="34" width="6" height="12"/><rect x="50" y="28" width="6" height="18"/><rect x="62" y="38" width="5" height="8"/></g>', $trait);
                $sol = '';
                break;
            case 'heliocentric':
                $forme = sprintf('<polygon points="22,58 34,38 58,32 78,44 74,66 46,74" fill="%s"/><polygon points="34,38 58,32 50,50" fill="%s" opacity="0.4"/>', $this->melange($couleur, '#ffffff', 0.15), $trait)
                    .sprintf('<rect x="52" y="22" width="3" height="12" fill="%s"/><circle cx="53.5" cy="21" r="3" fill="%s"/>', $trait, $trait);
                $sol = '';
                break;
            default:
                $forme = match ($s->habitat) {
                    'dome' => sprintf('<path d="M22 72 A28 28 0 0 1 78 72 Z" fill="%s" opacity="0.35" stroke="%s" stroke-width="1.5"/><rect x="38" y="56" width="8" height="16" fill="%s"/><rect x="50" y="62" width="10" height="10" fill="%s"/>', $couleur, $trait, $trait, $trait),
                    'underground' => sprintf('<g fill="%s"><rect x="20" y="52" width="6" height="20"/><rect x="40" y="46" width="14" height="26"/><polygon points="62,72 70,50 78,72"/></g>', $trait)
                        .sprintf('<g fill="%s" opacity="0.8"><rect x="28" y="78" width="44" height="5" rx="2"/><rect x="36" y="86" width="30" height="5" rx="2"/></g>', $trait),
                    default => sprintf('<g fill="%s"><rect x="18" y="52" width="10" height="20"/><rect x="32" y="42" width="12" height="30"/><rect x="48" y="48" width="10" height="24"/><rect x="62" y="38" width="12" height="34"/></g><circle cx="86" cy="64" r="7" fill="%s" opacity="0.6"/>', $trait, $this->melange('#6fd3a0', '#04060d', 0.1)),
                };
        }

        return $this->enveloppe($forme.$sol, '', $fond);
    }

    // ---------------------------------------------------------------- personnages

    private function personnage(string $id): ?string
    {
        $p = null;
        foreach ($this->fiches->personnages() as $x) {
            if ($x->id === $id) {
                $p = $x;
            }
        }
        if ($p === null) {
            return null;
        }
        $mots = array_values(array_filter(preg_split('/[\s\']+/u', (string) $p->nom) ?: [], static fn ($m) => !\in_array(mb_strtolower($m), ['le', 'la', 'les', 'père', 'de', 'des', "d'"], true) && $m !== ''));
        $initiales = mb_strtoupper(mb_substr($mots[0] ?? $p->nom, 0, 1).(isset($mots[1]) ? mb_substr($mots[1], 0, 1) : ''));
        $teinte = crc32($id) % 360;
        $fond = sprintf('hsl(%d 38%% 24%%)', $teinte);
        $texte = sprintf('<text x="50" y="50" text-anchor="middle" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="%d" font-weight="600" fill="%s">%s</text>', mb_strlen($initiales) > 1 ? 34 : 42, sprintf('hsl(%d 60%% 84%%)', $teinte), htmlspecialchars($initiales, \ENT_XML1 | \ENT_QUOTES));

        return $this->enveloppe($texte, '', $fond);
    }

    // ---------------------------------------------------------------- outils

    private function enveloppe(string $contenu, string $defs = '', ?string $fond = null): string
    {
        $arriere = $fond !== null ? sprintf('<rect width="100" height="100" fill="%s"/>', $fond) : '<rect width="100" height="100" fill="#07090f"/>';
        $etoiles = '';
        if ($fond === null) {
            for ($k = 0; $k < 14; ++$k) {
                $etoiles .= sprintf('<circle cx="%.1f" cy="%.1f" r="0.6" fill="#fff" opacity="0.5"/>', $this->alea('ciel', $k, 1) * 100, $this->alea('ciel', $k, 2) * 100);
            }
        }

        return '<?xml version="1.0" encoding="UTF-8"?>'
            .'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img">'
            .($defs !== '' ? '<defs>'.$defs.'</defs>' : '').$arriere.$etoiles.$contenu.'</svg>';
    }

    /** Valeur pseudo-aléatoire stable dans [0, 1[ : la même illustration à chaque requête. */
    private function alea(string $graine, int $rang, int $sel): float
    {
        return (crc32($graine.'|'.$rang.'|'.$sel) % 10000) / 10000;
    }

    private function hex(string $couleur): string
    {
        return preg_match('/^#[0-9a-fA-F]{6}$/', $couleur) === 1 ? strtolower($couleur) : '#8d9bb8';
    }

    /** Mélange deux couleurs hexadécimales : $part de $b dans le résultat. */
    private function melange(string $a, string $b, float $part): string
    {
        $ca = sscanf($this->hex($a), '#%02x%02x%02x');
        $cb = sscanf($this->hex($b), '#%02x%02x%02x');

        return sprintf('#%02x%02x%02x', ...array_map(static fn ($x, $y) => (int) round($x * (1 - $part) + $y * $part), $ca, $cb));
    }
}
