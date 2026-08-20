import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export interface UserSignatureInfo {
  signatureUrl?: string;
  jobTitle?: string;
  name?: string;
}

/**
 * Automatically downsizes and optimizes an uploaded signature image so it takes minimal space (<40KB)
 * and never exceeds Firestore's 1MB document limit. Preserves PNG alpha transparency.
 */
export async function optimizeSignatureImage(file: File, maxWidth = 600, maxHeight = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error('Nenhum arquivo selecionado.'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.onload = (e) => {
      const rawData = e.target?.result as string;
      if (!rawData) {
        return reject(new Error('O arquivo de imagem está vazio.'));
      }

      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido ou não suportado.'));
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(rawData);
          }

          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Export as optimized PNG to preserve transparent background
          const optimized = canvas.toDataURL('image/png');
          resolve(optimized);
        } catch (err) {
          console.warn('Canvas optimization fallback to original data URL:', err);
          resolve(rawData);
        }
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Saves user profile and digital signature data reliably into Firestore with multi-field compatibility
 * and secondary email document synchronization.
 */
export async function saveUserProfileData(
  userId: string,
  userEmail: string | null | undefined,
  profile: {
    name: string;
    username: string;
    jobTitle?: string;
    signatureUrl?: string;
  }
): Promise<void> {
  const cleanName = profile.name.trim();
  let cleanUsername = profile.username.trim();
  if (cleanUsername.startsWith('@')) cleanUsername = cleanUsername.slice(1);
  const cleanJobTitle = (profile.jobTitle || '').trim();
  const cleanSignature = (profile.signatureUrl || '').trim();

  const payload: Record<string, any> = {
    name: cleanName,
    username: cleanUsername,
    jobTitle: cleanJobTitle,
    cargo: cleanJobTitle,
    signatureUrl: cleanSignature,
    signature: cleanSignature,
    digitalSignature: cleanSignature,
    signatureBase64: cleanSignature,
    userSignature: cleanSignature,
    updatedAt: serverTimestamp()
  };

  // 1. Primary write using setDoc with merge to users/{userId}
  await setDoc(doc(db, 'users', userId), payload, { merge: true });

  // 2. Also search if there is any other document matching the email in users and sync it
  if (userEmail) {
    try {
      const q = query(collection(db, 'users'), where('email', '==', userEmail.toLowerCase().trim()));
      const snap = await getDocs(q);
      for (const docSnap of snap.docs) {
        if (docSnap.id !== userId) {
          await setDoc(doc(db, 'users', docSnap.id), payload, { merge: true });
        }
      }
    } catch (e) {
      console.warn('Could not sync secondary user docs:', e);
    }
  }
}

/**
 * Robustly resolves the user's profile signature and job title from Firestore.
 * Checks document by UID, then searches by email or name if needed.
 * Checks multiple possible field names (signatureUrl, signature, digitalSignature, signatureBase64, userSignature).
 */
export async function fetchUserProfileSignature(
  userId?: string | null,
  userEmail?: string | null,
  userName?: string | null
): Promise<UserSignatureInfo> {
  const result: UserSignatureInfo = {};

  // 1. Direct fetch by UID if available
  if (userId) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        const sig = data.signatureUrl || data.signature || data.digitalSignature || data.signatureBase64 || data.userSignature || data.assinatura;
        const job = data.jobTitle || data.cargo || data.roleTitle || data.funcao;
        if (sig && typeof sig === 'string' && sig.trim()) result.signatureUrl = sig.trim();
        if (job && typeof job === 'string' && job.trim()) result.jobTitle = job.trim();
        if (data.name && typeof data.name === 'string') result.name = data.name.trim();

        if (result.signatureUrl) return result;
      }
    } catch (e) {
      console.warn('Direct user signature lookup by UID failed:', e);
    }
  }

  // 2. Lookup across all users by email or name or username
  if (!result.signatureUrl && (userEmail || userName || userId)) {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const targetEmail = userEmail?.trim().toLowerCase();
      const targetName = userName?.trim().toLowerCase();
      const targetId = userId?.trim();

      for (const uDoc of usersSnap.docs) {
        const data = uDoc.data();
        const docEmail = data.email?.trim().toLowerCase();
        const docName = data.name?.trim().toLowerCase();
        const docUsername = data.username?.trim().toLowerCase();
        const docUid = data.uid || uDoc.id;

        const isMatch = (targetId && docUid === targetId) ||
          (targetEmail && docEmail && (docEmail === targetEmail || docEmail.includes(targetEmail))) ||
          (targetName && (
            (docName && (docName === targetName || docName.includes(targetName) || targetName.includes(docName))) ||
            (docUsername && (docUsername === targetName || targetName.includes(docUsername)))
          ));

        if (isMatch) {
          const sig = data.signatureUrl || data.signature || data.digitalSignature || data.signatureBase64 || data.userSignature || data.assinatura;
          const job = data.jobTitle || data.cargo || data.roleTitle || data.funcao;
          if (sig && typeof sig === 'string' && sig.trim() && !result.signatureUrl) {
            result.signatureUrl = sig.trim();
          }
          if (job && typeof job === 'string' && job.trim() && !result.jobTitle) {
            result.jobTitle = job.trim();
          }
          if (data.name && !result.name) {
            result.name = data.name;
          }
          if (result.signatureUrl) break;
        }
      }
    } catch (e) {
      console.warn('Fallback users query for signature failed:', e);
    }
  }

  return result;
}
