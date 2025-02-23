const loginWith = async (page, username, password) => {
  // Daha iyi bir çözüm, inputlar için benzersiz test id attributelari tanımlamak ve bunları getByTestId methodunu kullanarak testlerde aramaktır.
  await page.getByTestId('username').fill(username)
  await page.getByTestId('password').fill(password)
  await page.getByRole('button', { name: 'login' }).click()
}

const createBlog = async (page, { title, author, url }) => {
  await page.getByRole('button', { name: 'create new blog' }).click()
  await page.getByLabel('title').fill(title)
  await page.getByLabel('author').fill(author)
  await page.getByLabel('url').fill(url)
  await page.getByRole('button', { name: 'create' }).click()
}

export { loginWith, createBlog }
