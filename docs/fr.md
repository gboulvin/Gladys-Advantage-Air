# Advantage Air

Pilotez votre climatisation gainable **Advantage Air** — systèmes **MyAir**,
**e-zone** et **MyPlace** — depuis Gladys. L'intégration dialogue avec la
tablette murale du système sur votre **réseau local** : pas de compte, pas de
cloud, elle fonctionne même sans Internet.

## Présentation

Une fois configurée, l'intégration trouve tous les appareils du système :

- **Climatiseurs** : marche/arrêt, mode (froid, chaud, ventilation,
  déshumidification et MyAuto si disponible), consigne (16–32 °C), vitesse de
  ventilation (faible, moyenne, forte, auto / MyFan), minuteurs d'allumage et
  d'extinction (minutes), air frais si équipé.
- **Zones** : ouverture / fermeture, pourcentage d'ouverture (5–100 %) des
  zones sans capteur de température ; température, consigne, **MyZone**,
  signal du capteur et mouvement (si le capteur le détecte) des zones avec
  capteur.
- **MyLights** : marche/arrêt et luminosité des lumières variables.
- **MyThings** : volets et portes de garage (ouvrir / fermer), lumières et
  relais.

## Prérequis

- Un système Advantage Air dont la tablette murale fait tourner l'application
  **MyAir**, **e-zone** ou **MyPlace**. Laissez l'application ouverte : c'est
  elle qui sert l'API locale.
- La tablette et Gladys sur le **même réseau local**.
- Une **adresse IP fixe** pour la tablette : réservez-la dans votre box
  (bail DHCP statique), sinon l'intégration la perd quand l'adresse change.
- Gladys 5.3 ou plus récent.

## Configuration

1. Trouvez l'adresse IP de la tablette (paramètres Android → À propos de la
   tablette → État, ou la liste des appareils de votre box).
2. Dans Gladys, ouvrez l'onglet **Configuration** de l'intégration et
   saisissez-la dans **Adresse IP de la tablette**. Laissez le port **2025**.
3. Modifiez si besoin l'**Intervalle de rafraîchissement** : la fréquence de
   lecture de la tablette (15 secondes par défaut, de 5 à 300). Un intervalle
   plus court affiche plus vite les changements faits sur la tablette.
4. Enregistrez, puis cliquez sur **Tester la connexion** : l'intégration
   liste les climatiseurs, zones, lumières et canaux MyThings trouvés.
5. Ouvrez l'onglet **Découverte** et ajoutez les appareils voulus.

## Scènes

L'éditeur de scènes reçoit de nouvelles cartes dans la catégorie
**Intégrations** :

- Déclencheurs : **Climatiseur allumé ou éteint**, **Mode de climatisation
  changé**, **Filtre à nettoyer**, **Erreur du climatiseur**, **Zone ouverte
  ou fermée**, **Mouvement détecté dans une zone**. Chacun peut être filtré
  sur un appareil ; leurs détails sont lisibles dans les actions suivantes,
  par exemple `{{triggerEvent.data.error_code}}`.
- Actions : **Piloter un climatiseur** (marche, mode, ventilation et consigne
  en une seule commande), **Piloter une zone**, **Ouvrir ou fermer toutes les
  zones**, **Définir la MyZone**, **Programmer un minuteur** (0 minute
  l'annule).

Les déclencheurs « état d'un appareil » et l'action « contrôler un appareil »
habituels fonctionnent aussi.

## Tableau de bord

- Widget **Climatiseur** : consigne et température de la MyZone (en direct),
  marche, mode, ventilation, filtre, erreur et minuteurs, avec un bouton pour
  allumer ou éteindre l'appareil.
- Widget **Zones** : état, ouverture et température de chaque zone, avec des
  boutons pour toutes les ouvrir ou toutes les fermer.

Dans les réglages du widget, choisissez le climatiseur à afficher (le premier
sinon).

## Dépannage

- **« La tablette Advantage Air ne répond pas »** : vérifiez que la tablette
  est allumée, que l'application MyAir / e-zone / MyPlace est ouverte (la
  tablette ne doit pas être en veille application fermée) et que l'adresse
  n'a pas changé. Ouvrez `http://<adresse de la tablette>:2025/getSystemData`
  dans un navigateur sur le même réseau : un document JSON doit s'afficher.
- **Un changement fait dans Gladys revient à sa valeur précédente** :
  l'appareil l'a refusé (par exemple le mode MyAuto sur un système qui ne
  l'a pas). L'intégration affiche toujours l'état confirmé par la tablette.
- **Une zone manque** : les zones au-delà du nombre configuré sur l'appareil
  sont ignorées. Les zones ajoutées plus tard apparaissent dans l'onglet
  Découverte.
- **Sécurité** : l'API locale de la tablette n'a pas de mot de passe.
  N'exposez jamais le port 2025 sur Internet.
