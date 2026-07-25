export async function onRequest(context) {
  const response = await context.env.ASSETS.fetch(context.request);
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok || !contentType.includes("text/html")) {
    return response;
  }

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        element.append(
          '<meta name="msvalidate.01" content="23A368B2C5F4DF3471A67EA6CB057149">',
          { html: true },
        );
      },
    })
    .transform(response);
}
