import * as admin from 'firebase-admin';
import * as path from 'path';

// Initialize Firebase
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function deleteCanadianCards() {
  console.log('Fetching Canadian cards...');

  const snapshot = await db.collection('credit_cards')
    .where('countryCode', '==', 'CA')
    .get();

  console.log('Found ' + snapshot.size + ' Canadian cards to delete');

  if (snapshot.empty) {
    console.log('No Canadian cards found');
    return;
  }

  const batch = db.batch();
  let count = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    count++;
    const data = doc.data();
    console.log('Queued for deletion: ' + data.name);
  }

  await batch.commit();
  console.log('\nDeleted ' + count + ' Canadian cards');
}

deleteCanadianCards()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
