const { test, expect, describe, beforeEach } = require('@playwright/test')
const { loginWith, createBlog } = require('./helper')

describe('Blog App', () => {
  beforeEach(async ({ page, request }) => {
    await request.post('/api/testing/reset')
    await request.post('/api/users', {
      data: {
        name: 'Mehmet Aydar',
        username: 'QXyGeN',
        password: 'M12345678',
      },
    })

    await page.goto('/')
  })

  test('Login form is shown', async ({ page }) => {
    const usernameInput = page.getByTestId('username')
    const passwordInput = page.getByTestId('password')
    const loginButton = page.getByRole('button', { name: 'login' })

    await expect(page.getByText('login to application')).toBeVisible()
    await expect(usernameInput).toBeVisible()
    await expect(usernameInput).toBeEmpty()
    await expect(passwordInput).toBeVisible()
    await expect(passwordInput).toBeEmpty()
    await expect(loginButton).toBeVisible()
    await expect(loginButton).toBeEnabled()
  })

  describe('Login', () => {
    test('succeeds with correct credentials', async ({ page }) => {
      await loginWith(page, 'QXyGeN', 'M12345678')
      await expect(page.getByText('Mehmet Aydar logged in')).toBeVisible()
    })

    test('fails with wrong credentials', async ({ page }) => {
      await loginWith(page, 'QXyGeN', 'wrong')
      const errorDiv = page.locator('.error')
      await expect(errorDiv).toContainText('invalid username or password')
      await expect(errorDiv).toHaveCSS('color', 'rgb(255, 0, 0)')
      await expect(errorDiv).toHaveCSS('border-style', 'solid')
      await expect(page.getByText('Mehmet Aydar logged in')).not.toBeVisible()
    })
  })

  /*  url https://www.youtube.com/c/ArinYazilim/playlists title Arin Yazilim channel is one of the best youtube channels author Gürcan Çekiç  */
  describe('when logged in', () => {
    beforeEach(async ({ page }) => {
      await loginWith(page, 'QXyGeN', 'M12345678')
    })

    test('a new blog can be created', async ({ page }) => {
      const blogInfoLoc = page.locator('.blogInfo')
      const successDiv = page.locator('.success')
      const blogInfo = {
        title: 'test title',
        author: 'test author',
        url: 'test url',
      }
      await createBlog(page, blogInfo)
      await expect(blogInfoLoc).toHaveText(/test title - test author/i)
      await expect(blogInfoLoc).toHaveCount(1)
      await expect(successDiv).toHaveCSS('color', 'rgb(0, 128, 0)')
      await expect(successDiv).toHaveCSS('border-style', 'solid')
      await expect(
        successDiv.getByText('a new blog test title - test author added')
      ).toBeVisible()
    })

    describe('and a bloge exists', () => {
      beforeEach(async ({ page }) => {
        const blogInfo = {
          title: 'test title',
          author: 'test author',
          url: 'test url',
        }
        await createBlog(page, blogInfo)
      })

      test('a blog can be liked when it is created', async ({ page }) => {
        // Blog detaylarını görüntüleyen view butonuna tıkla
        await page.getByRole('button', { name: 'view' }).click()

        const likesInfo = page.locator('.likes')
        // Başlangıçtaki like sayısını doğrula
        await expect(likesInfo).toHaveText(/likes: 0/i)

        // Like butonuna tıkla
        await page.getByRole('button', { name: 'like' }).click()

        // Like sayısının 1 arttığını doğrula
        await expect(likesInfo).toHaveText(/likes: 1/i)

        // Like butonuna tekrar tıkla
        await page.getByRole('button', { name: 'like' }).click()

        // Like sayısının 2 olduğunu doğrula
        await expect(likesInfo).toHaveText(/likes: 2/i)
      })

      test('a blog can be deleted by the user who created the blog', async ({
        page,
      }) => {
        // Blog detaylarını görüntüleyen view butonuna tıkla
        await page.getByRole('button', { name: 'view' }).click()

        // Remove(silme) butonuna basmadan önce confirm dialog'u yakala ve kabul et
        page.on('dialog', async (dialog) => {
          expect(dialog.type()).toBe('confirm')
          expect(dialog.message()).toContain(
            'Remove blog test title by test author'
          )
          await dialog.accept()
        })

        // remove butonuna bas
        await page.getByRole('button', { name: 'remove' }).click()

        // Blogun artık görünmediğini doğrula
        await expect(page.getByText('test title - test author')).toHaveCount(0)
      })

      test('only the user who added the blog sees the blog"s delete button.', async ({
        page,
        request,
      }) => {
        const removeButton = page.getByRole('button', { name: 'remove' })

        // "Remove" butonunun görünür olduğunu doğrula
        await expect(
          page.getByText('test title - test author', { exact: true })
        ).toBeVisible()
        await page.getByRole('button', { name: 'view' }).click()
        await expect(removeButton).toBeVisible()

        // Çıkış yap
        await page.getByRole('button', { name: 'logout' }).click()

        // Farklı kullanıcıyı kaydet
        await request.post('/api/users', {
          data: {
            name: 'Ali Aksan',
            username: 'kralim',
            password: 'A12345678',
          },
        })

        // Farklı kullanıcı ile giriş yap
        await loginWith(page, 'kralim', 'A12345678')

        await page.getByRole('button', { name: 'view' }).click()
        await expect(removeButton).not.toBeVisible()
        await expect(removeButton).toHaveCount(0)
      })

      test('blogs should be sorted by likes in descending order', async ({
        page,
      }) => {
        /* 
          Bu testin mantığı şu şekilde olmalı:

          ✅ Blogların like (beğeni) sayısına göre sıralandığını doğrulamak.
          ✅ En çok beğeni alan blog en üstte olmalı.

          🛠 Testin Adımları
          1️⃣ Sayfayı aç.
          2️⃣ Birden fazla blog ekle, her birinin farklı like sayısı olsun.
          3️⃣ Like butonuna tıklayarak bazı bloglara like ekle.
          4️⃣ Tüm blogları DOM'dan oku ve beğeni sayılarını al.
          5️⃣ Beğeni sayılarını sıralayıp doğru sırada olup olmadığını kontrol et.
        */

        // Farklı beğeni sayılarına sahip 3 blog ekleyelim
        const blogs = [
          {
            title: 'API Layer & Fetch Functions',
            author: 'Johannes Kettmann',
            url: 'https://profy.dev/article/react-architecture-api-layer-and-fetch-functions',
            likes: 3,
          },
          {
            title: 'Rest API Architecture',
            author: 'Ritu Shikha',
            url: 'https://medium.com/@shikha.ritu17/rest-api-architecture-6f1c3c99f0d3',
            likes: 7,
          },
        ]

        for (const blog of blogs) {
          await page.getByRole('button', { name: 'cancel' }).click()
          await createBlog(page, blog)

          const blogElement = page.locator(
            `.blog-item:has-text("${blog.title} - ${blog.author}")`
          )
          await expect(blogElement).toBeVisible()
        }

        // Bloglara like ekleyelim (örneğin her bloğa likes sayısı kadar like)
        for (const blog of blogs) {
          const blogElement = page.locator(
            `.blog-item:has-text("${blog.title} - ${blog.author}")`
          )
          await blogElement.getByRole('button', { name: 'view' }).click()
          const likesInfo = page.locator('.likes')

          for (let i = 0; i < blog.likes; i++) {
            await blogElement.getByRole('button', { name: 'like' }).click()
            await expect(likesInfo).toHaveText(`likes: ${i + 1}`)
          }
          await blogElement.getByRole('button', { name: 'hide' }).click()
        }

        // Tüm "view" butonlarına bas
        const viewButtons = await page.locator('.toggleButton').all()
        for (const button of viewButtons) {
          await button.click()
        }

        // Like sayılarını oku
        const blogLikes = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.likes')).map((el) => {
            return parseInt(el.textContent.match(/\d+/)[0])
          })
        })

        const sortedLikes = [...blogLikes].sort((a, b) => b - a)
        console.log('sortedlikes', sortedLikes, 'bloglikes', blogLikes)

        expect(blogLikes).toEqual(sortedLikes)
      })
    })
  })
})
