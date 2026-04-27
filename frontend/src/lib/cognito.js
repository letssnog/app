import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
} from "amazon-cognito-identity-js";

const region = process.env.REACT_APP_COGNITO_REGION;
const userPoolId = process.env.REACT_APP_COGNITO_USER_POOL_ID;
const clientId = process.env.REACT_APP_COGNITO_APP_CLIENT_ID;

if (!region || !userPoolId || !clientId) {
  // Keep runtime error messages readable in the browser.
  // (We intentionally don't add fallbacks here.)
  // eslint-disable-next-line no-console
  console.warn("Missing Cognito env vars: REACT_APP_COGNITO_REGION/USER_POOL_ID/APP_CLIENT_ID");
}

export const userPool = new CognitoUserPool({
  UserPoolId: userPoolId,
  ClientId: clientId,
});

export function getCurrentCognitoUser() {
  return userPool.getCurrentUser();
}

export function signUp({ email, password, name }) {
  return new Promise((resolve, reject) => {
    userPool.signUp(
      email,
      password,
      [{ Name: "email", Value: email }, ...(name ? [{ Name: "name", Value: name }] : [])],
      null,
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}

export function confirmSignUp({ email, code }) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    user.confirmRegistration(code, true, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

export function signIn({ email, password }) {
  return new Promise((resolve, reject) => {
    const user = new CognitoUser({ Username: email, Pool: userPool });
    const auth = new AuthenticationDetails({ Username: email, Password: password });
    user.authenticateUser(auth, {
      onSuccess: (session) => resolve({ user, session }),
      onFailure: (err) => reject(err),
      newPasswordRequired: () => reject(new Error("New password required")),
    });
  });
}

export function signOut() {
  const u = getCurrentCognitoUser();
  if (u) u.signOut();
}

export function getIdTokenJwt() {
  return new Promise((resolve) => {
    const u = getCurrentCognitoUser();
    if (!u) return resolve(null);
    u.getSession((err, session) => {
      if (err || !session?.isValid?.()) return resolve(null);
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

