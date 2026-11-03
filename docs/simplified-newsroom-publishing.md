# Simplified Newsroom Publishing

NewsNeta Studio uses one article form for reporters and administrators. The public website layout is not changed by this workflow.

## Reporter process

1. Sign in and open **Create Article**.
2. Enter the news headline and complete article body.
3. Select the category. For Telangana or Andhra Pradesh news, select the state and district.
4. Select **Choose Files** to upload one or more photos or videos from a desktop or mobile device. The first photo is used as the article image and thumbnail.
5. Open **Source and media details** and record the source, caption, alt text, copyright owner and usage rights.
6. Select **Save Draft** to continue later, **Preview** to check the reader view, and **Submit for Review** when the story is ready.

The generated card summary never replaces the full article body. A reporter cannot publish directly or edit another reporter's article.

## Reviewer process

1. Open **Review & Publish**.
2. Check the complete article, regional classification, source notes and media rights.
3. Approve the article or request changes.

Reviewer approval and its audit record are written in one database transaction. Media remains private until it is approved and the article is published.

## Administrator process

An administrator can publish an approved reporter article from **Review & Publish**, or create an original story in one session:

1. Complete the same article form.
2. Select **Preview** or **Publish Now**.
3. Review the final preview and select **Confirm Publish**.

The server validates the article and media, approves owned media, writes the workflow audit and publishes the article in one transaction. Repeated requests use an idempotency key and cannot create duplicate publications. Under **Publishing options**, an administrator can mark breaking news or schedule a future publication.

## Release requirements

- Apply `netlify/database/migrations/20261103100000_simplified_newsroom_publish/migration.sql` before enabling the new publish endpoint.
- Configure the existing CMS account variables, `CMS_SESSION_SECRET`, PostgreSQL connection and Netlify Blobs media store.
- Run `npm test` and `npm run check` before deployment.
- Verify one uploaded image and one scheduled article in the target environment before production promotion.
