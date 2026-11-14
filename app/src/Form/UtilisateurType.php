<?php

declare(strict_types=1);

namespace App\Form;

use App\Entity\User;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Symfony\Component\Validator\Constraints\Length;
use Symfony\Component\Validator\Constraints\NotBlank;
use Symfony\Component\Validator\Constraints\NotCompromisedPassword;

final class UtilisateurType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $creation = $options['creation'];
        $builder
            ->add('nom', TextType::class, ['label' => 'Nom affiché'])
            ->add('email', EmailType::class, ['label' => 'Email (identifiant)'])
            ->add('admin', CheckboxType::class, [
                'label' => 'Administrateur (modifie les valeurs par défaut, gère les comptes)',
                'mapped' => false,
                'required' => false,
                'data' => $options['data']->estAdmin(),
            ])
            ->add('actif', CheckboxType::class, ['label' => 'Compte actif', 'required' => false])
            ->add('motDePasse', PasswordType::class, [
                'label' => $creation ? 'Mot de passe' : 'Nouveau mot de passe (vide = inchangé)',
                'mapped' => false,
                'required' => $creation,
                'attr' => ['autocomplete' => 'new-password'],
                'constraints' => [
                    ...($creation ? [new NotBlank()] : []),
                    new Length(min: 12, max: 4096, minMessage: '12 caractères minimum.'),
                    new NotCompromisedPassword(skipOnError: true),
                ],
            ]);
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults(['data_class' => User::class, 'creation' => false]);
    }
}
