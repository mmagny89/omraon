<?php

declare(strict_types=1);

namespace App\Security;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\Attribute\AsEventListener;
use Symfony\Component\Security\Http\Event\LoginSuccessEvent;

final readonly class DerniereConnexionListener
{
    public function __construct(private EntityManagerInterface $em)
    {
    }

    #[AsEventListener]
    public function __invoke(LoginSuccessEvent $event): void
    {
        $user = $event->getUser();
        if ($user instanceof User) {
            $user->setDerniereConnexion(new \DateTimeImmutable());
            $this->em->flush();
        }
    }
}
