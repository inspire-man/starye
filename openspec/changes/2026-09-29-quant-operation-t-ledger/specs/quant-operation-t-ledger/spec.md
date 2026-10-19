## ADDED Requirements

### Requirement: Same-day trades stay together

The ledger MUST pair a sell with a buy from the same Shanghai calendar day before using older lots. Remaining lots MUST stay open. Fees MUST reduce the closed price difference and MUST be included in the remaining average cost. Dividends MUST be cash and MUST NOT change the win rate.

#### Scenario: Zijin book

- **WHEN** the recorded Zijin fills include the three same-day round trips, seven unpaired buys, and two dividends
- **THEN** the closed results are 34.50, 15.35, and 30.89
- **AND** 700 shares remain open
- **AND** dividend cash is 560
- **AND** the win rate stays withheld
