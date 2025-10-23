/** @type {import('@sveltejs/kit').Handle} */
export const handle = async ({ event, resolve }) => {
  event.locals.userid = event.cookies.get('userid') || crypto.randomUUID();

  const response = await resolve(event);

  if (!event.cookies.get('userid')) {
    // if this is the first time the user has visited this app,
    // set a cookie so that we recognise them when they return
    event.cookies.set('userid', event.locals.userid, {
      path: '/',
      httpOnly: true
    });
  }

  return response;
};
