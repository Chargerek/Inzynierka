# Skrypt demonstracji (ok. 5 minut)

Przygotowanie: `docker compose up -d`, aplikacja na [localhost:3000](http://localhost:3000),
Mailpit na [localhost:8025](http://localhost:8025). Wszystkie konta mają hasło **Demo123!**.

## 1. Rejestracja i bezpieczeństwo (~45 s)

1. Otwórz [localhost:3000/rejestracja](http://localhost:3000/rejestracja).
2. Zwróć uwagę na **wymagany checkbox zgody** na przetwarzanie danych (w tym o zdrowiu)
   — bez zaznaczenia formularz się nie wyśle (walidacja po stronie API: 422).
3. Wspomnij: hasła bcrypt, token JWT, pacjent widzi wyłącznie własne dane (test IDOR → 403),
   zdjęcia tylko po zalogowaniu, upload weryfikowany po zawartości pliku.

## 2. Pacjent rezerwuje wizytę (~1 min)

1. Zaloguj się jako **jan.nowak@gabinet.pl**.
2. **Umów wizytę** → kreator: usługa (np. Kontrola) → lekarz (Anna Kowalska) →
   data i wolny termin → potwierdzenie.
3. Pokaż **Wizyta zarezerwowana** i nową pozycję w panelu.
4. Otwórz [localhost:8025](http://localhost:8025) — **e-mail z potwierdzeniem** w Mailpicie.
5. Odwołaj wizytę w panelu — drugi e-mail (odwołanie). *(Można zostawić wizytę z seeda.)*

## 3. Lekarz i mapa ciała (~1,5 min)

1. Wyloguj, zaloguj jako **lekarz@gabinet.pl**.
2. Zakładka **Kartoteka** → pacjent **Jan Nowak** (2 raporty).
3. Otwórz raport z 6 października: **mapa ciała** z 3 zmianami na twarzy
   (krostki, zaskórniak). Kliknij zmianę na liście — podświetli się na mapie.
4. Pokaż przełącznik **Przód/Tył** i powiększanie (kółko / dwa palce).
5. Dodaj nową zmianę: **+ Dodaj zmianę** → klik na sylwetkę → typ, kolor, opis
   (można usunąć, żeby nie zostawiać śladu).

## 4. Historia i porównanie (~1 min)

1. Wróć do listy raportów Jana — **oś czasu** dokumentacji.
2. Zaznacz oba raporty checkboxem **do porównania** → **Porównaj wybrane**.
3. Widok side-by-side: przed (3 zmiany zapalne) → po (2 przebarwienia pozapalne),
   pasek różnicy „3 → 2 (−1)”. To jest historia leczenia trądziku.

## 5. Panel administratora (~30 s)

1. Wyloguj, zaloguj jako **admin@gabinet.pl**.
2. Lista użytkowników i wizyt, możliwość dodania konta lekarza.

## Zapasowe pytania / gwiazdki

- **Testy:** `docker compose exec api python -m pytest tests/ -q` (49 testów),
  `npm run test:e2e` w `apps/web` (Playwright: rezerwacja + mapa na desktopie i tablecie).
- **Swagger:** [localhost:8000/docs](http://localhost:8000/docs); kolekcja: `docs/openapi.json`.
- **Prywatność:** `docs/prywatnosc.md`.
- Druga pacjentka **maria.wisniewska@gabinet.pl** ma raport ze znamionami na plecach (sylwetka żeńska).
