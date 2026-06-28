/**
 * Politique de mot de passe Grinta, partagée client/serveur.
 * 12+ caractères avec minuscule, majuscule, chiffre et symbole.
 */
export function isStrongPassword(pw: string): boolean {
  return (
    pw.length >= 12 &&
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /\d/.test(pw) &&
    /[^A-Za-z0-9]/.test(pw)
  );
}
