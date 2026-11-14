<?php

declare(strict_types=1);

namespace App\Security;

use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\Security\Http\Event\LoginFailureEvent;

/** Un échec de connexion laisse une trace lisible (adresse, identifiant haché) : sans elle, une attaque par essais successifs passe inaperçue. */
final readonly class EchecConnexionListener
{
    public function __construct(private LoggerInterface $logger)
    {
    }

    #[AsEventListener]
    public function __invoke(LoginFailureEvent $event): void
    {
        $r = $event->getRequest();
        $this->logger->warning('Échec de connexion depuis {ip} (identifiant {identifiant}, {raison})', [
            'ip' => $r->getClientIp(),
            'identifiant' => substr(hash('sha256', mb_strtolower((string) $r->request->get('_username'))), 0, 12),
            'raison' => $event->getException()::class,
        ]);
    }
}
