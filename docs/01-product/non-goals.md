# Non-Goals for V1

Do **not** build:

- social network
- followers
- likes
- comments
- public profiles
- public wardrobes
- influencer features
- clothing marketplace
- resale marketplace
- advertising platform
- fashion brand dashboard
- desktop app
- social feed
- shopping-first recommendation engine
- AR live mirror
- complex wardrobe sharing

These can be revisited later. They are excluded now because each one either
competes with the core loop (know → style → see) or introduces privacy surface
area that Mira has not earned yet.

## Why each is excluded

| Non-goal                       | Reason                                                              |
| ------------------------------ | ------------------------------------------------------------------- |
| Social graph, feed, comments   | Closets are private by default. A social layer inverts that default. |
| Public wardrobes / profiles    | Same. There is no public closet in V1. See `docs/07-security/privacy.md`. |
| Marketplace / resale           | Turns garments into listings, and Mira into logistics.              |
| Advertising / brand dashboards | Aligns the product with retailers rather than with the user.        |
| Shopping-first recommendations | Mira's job is to make owned clothing feel exciting again.           |
| Desktop app                    | The capture surface is a phone camera.                              |
| AR live mirror                 | Enormously harder than still try-on, for less of the actual benefit. |
| Wardrobe sharing               | Requires a permission model that does not exist yet.                |

## Adjacent things that ARE goals, to avoid confusion

- Shopping recommendations **may** become a future feature — after the closet
  experience is excellent. They are not in V1 and must never displace
  "style what you own" as the primary experience.
- Sharing a single generated look via the OS share sheet is acceptable. A
  Mira-hosted public page is not.
