// Gives the brain page with this start's write token written into its head, for the page to send back as `X-Brain-Token`.
export const servePage = ({ readPage, token }) => () =>
  readPage().replace(/<head>/, `<head>\n<meta name="brain-token" content="${token}">`)
