/* Configuração do Firebase (Firestore) para guardar os logs das partidas automaticamente.
 * Estes dois valores NÃO são segredo (todo site com Firebase mostra eles no navegador); quem protege os dados são as regras do Firestore.
 * Vazio = envio automático desligado (continua dando para "Baixar log"). Passo a passo: jogo/README.md, seção "Logs na nuvem". */
window.FIREBASE_CFG = window.FIREBASE_CFG || { apiKey: '', projectId: '' };
