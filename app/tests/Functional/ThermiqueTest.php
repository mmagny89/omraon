<?php

declare(strict_types=1);

namespace App\Tests\Functional;

use App\Service\FichesService;
use App\Service\Thermique;
use Symfony\Bundle\FrameworkBundle\Test\KernelTestCase;

final class ThermiqueTest extends KernelTestCase
{
    /** Le miroir PHP doit rester d'accord avec physics/thermique.js (fixture produite par outils/generer-thermique.mjs). */
    public function testMemesTemperaturesQueLeFront(): void
    {
        self::bootKernel();
        $fiches = static::getContainer()->get(FichesService::class);
        $fixture = json_decode((string) file_get_contents(__DIR__.'/../fixtures/thermique.json'), true, 16, \JSON_THROW_ON_ERROR);
        $verifies = 0;
        foreach ($fixture as $id => $attendu) {
            $a = $fiches->astre($id);
            self::assertNotNull($a, $id);
            $t = $a['temperatures'];
            self::assertSame($attendu['mode'], $t['mode'], $id);
            foreach (['jour', 'nuit', 'moyenne'] as $k) {
                // tolérance : le front part des éléments osculateurs du N-corps, le PHP des éléments nominaux
                self::assertEqualsWithDelta($attendu[$k], $t[$k], max(2.0, 0.02 * $attendu[$k]), "$id $k");
            }
            ++$verifies;
        }
        self::assertGreaterThanOrEqual(14, $verifies);
    }

    public function testLaFicheAffichePointsChaudEtFroid(): void
    {
        self::bootKernel();
        $t = static::getContainer()->get(Thermique::class);
        $sys = json_decode((string) file_get_contents(__DIR__.'/../../donnees/canon/systeme.json'), false, 64, \JSON_THROW_ON_ERROR);
        $kalpra = $t->faces($sys->STAR, $sys->PLANETS[0]);
        self::assertSame('solide', $kalpra['mode']);
        self::assertGreaterThan(600, $kalpra['jour']);
        self::assertLessThan(200, $kalpra['nuit']);
    }
}
