# Study of supplied Android finance screenshots

All 26 PNG screenshots in `RIVALS APK` were inspected. They comprise six Money Manager Ex screens and twenty Bluecoins screens. The APK in that folder was not decompiled and is not used as source.

| Evidence | Useful pattern | DIWAN decision |
| --- | --- | --- |
| MMEX 133242, Bluecoins 133529 | Grouped accounts, explicit currency, direct balances | Accounts is a main destination; a row opens its register |
| MMEX 133250, Bluecoins 133431–133435 | Compact transaction rows with dates, payee/category, account and amount | Date-grouped Activity ledger, meaningful type icons, explicit signs and codes |
| MMEX 133256 | Amount-forward full-screen entry | Expense/Income/Transfer controls, large amount input, existing validation and splits |
| MMEX 133315–133323 | Fast account and period selection | Focused account/period bottom sheets and type filters |
| Bluecoins 133440–133447 | Separate details, quick edit, similar records | Dedicated detail route with edit and duplicate actions |
| Bluecoins 133402–133426 | Monthly review, favorite accounts, net earnings and credit context | Quiet Overview with real monthly engine values and account balances; no invented graphs |
| Bluecoins 133455 | Schedules as a separate task | Scheduled transactions remain reachable under More and Overview |
| Bluecoins 133500–133509 | Balance groups and one-month budget review | Flat account groups and single-month envelope allocations |
| Bluecoins 133515–133518 | Secondary summaries and labels | Reports and tags remain real engine tools under More |
| MMEX 133303, Bluecoins 133523 | Secondary tool navigation | Progressive disclosure under More rather than a desktop sidebar |
| Bluecoins 133539–133545 | Categorized records and searchable labels | Preserve category/tag tools in the mobile task area |

DIWAN uses its own interface, color roles, SVGs and synthetic test fixtures. Reference screenshots, private financial figures, third-party logos and application binaries are not included in the GitHub source.
