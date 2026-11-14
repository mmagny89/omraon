<?php

declare(strict_types=1);

namespace App\Command;

use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Attribute\Option;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Finder\Finder;

/**
 * `tailwind:build` du bundle ne compile qu'une feuille d'entrée par appel (la première sans argument) ; le projet en a deux
 * (pages et vue). Cette commande les compile toutes : c'est elle que lancent l'image et le démarrage de dev.
 */
#[AsCommand(name: 'app:tailwind:build', description: 'Compile toutes les feuilles Tailwind d\'assets/styles.')]
final class TailwindToutCommand extends Command
{
    public function __construct(private readonly string $projetDir)
    {
        parent::__construct();
    }

    public function __invoke(OutputInterface $sortie, #[Option('Minifier la sortie')] bool $minify = false): int
    {
        $build = $this->getApplication()?->find('tailwind:build') ?? throw new \LogicException('Application absente.');
        $entrees = iterator_to_array((new Finder())->files()->in($this->projetDir.'/assets/styles')->name('*.css')->sortByName(), false);
        $statut = Command::SUCCESS;
        foreach ($entrees as $fichier) {
            $sortie->writeln('Tailwind : '.$fichier->getFilename());
            $args = ['input_css' => $fichier->getRealPath()] + ($minify ? ['--minify' => true] : []);
            if ($build->run(new ArrayInput($args), $sortie) !== Command::SUCCESS) {
                $statut = Command::FAILURE;
            }
        }

        return $statut;
    }
}
