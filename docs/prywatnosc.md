# Notatka o prywatności i bezpieczeństwie danych

Aplikacja jest projektem **demonstracyjnym** (inżynierskim) uruchamianym lokalnie w Dockerze.
Nie jest to system produkcyjny do prowadzenia dokumentacji medycznej.

## Jakie dane przechowujemy

- **Konto:** imię, nazwisko, adres e-mail, opcjonalnie telefon, rola (pacjent / lekarz / admin).
- **Dokumentacja:** raporty medyczne, zmiany skórne zaznaczone na sylwetce, zdjęcia dołączone przez lekarza.
- **Wizyty:** termin, usługa, status, powiązanie pacjent–lekarz.
- **Zgoda:** data i godzina wyrażenia zgody na przetwarzanie danych (`consent_at`), zbierana przy rejestracji.

## Czego świadomie NIE przechowujemy

- numeru PESEL,
- adresu zamieszkania,
- danych płatniczych / numerów kart.

## Jak chronimy dane

- **Hasła** przechowywane wyłącznie jako skrót bcrypt — nigdy w postaci jawnej.
- **Uwierzytelnianie** tokenem JWT (sekret z zmiennej środowiskowej, nie w kodzie).
- **Kontrola dostępu po stronie serwera:**
  - pacjent widzi wyłącznie własną dokumentację i własne wizyty (próba dostępu do cudzych danych kończy się odpowiedzią 403),
  - lekarz widzi wyłącznie pacjentów, z którymi ma lub miał wizytę,
  - administrator ma dostęp techniczny do kont (bez podglądu haseł).
- **Zdjęcia** nie są serwowane statycznie — każde pobranie wymaga ważnego tokenu i przejścia kontroli dostępu.
- **Uploady:** dozwolone wyłącznie JPEG, PNG i WebP do 5 MB; typ pliku weryfikowany jest po zawartości
  (tzw. magic bytes), więc plik .exe podszywający się pod zdjęcie zostanie odrzucony.

## Zgoda przy rejestracji

Formularz rejestracji wymaga zaznaczenia zgody na przetwarzanie danych osobowych
(w tym danych o zdrowiu). Data wyrażenia zgody zapisywana jest w bazie (`users.consent_at`).

## Uwagi

- Komunikacja lokalna (localhost) odbywa się bez TLS; przy wdrożeniu publicznym
  należałoby dodać HTTPS, rotację sekretów i politykę retencji danych.
- Baza demonstracyjna jest seedowana przykładowymi kontami — hasła demo nie nadają się do użytku produkcyjnego.
