# quant-daily-action

## ADDED Requirements

### Requirement: Daily buy and sell actions

The system MUST return one action for each stock tracked by the authenticated user. Buy MUST require a bullish saved report, a finite buy range, no open quantity, a same-day or prior price inside that range, and no triggered trend break or chase-risk check. Sell MUST require an open quantity and a bearish saved report. A trend break MUST NOT by itself produce a sell. The action text MUST NOT be an order.

#### Scenario: Empty position inside the saved range

- **WHEN** the user has no open quantity, the saved report is bullish, and today's price is inside the saved buy range
- **THEN** the action is buy
- **AND** the reason includes today's price and the saved range

#### Scenario: Open position turns bearish

- **WHEN** the user has an open quantity and the saved report is bearish
- **THEN** the action is sell

#### Scenario: Extended holding is not sold

- **WHEN** the user has an open quantity and only a volume or streak check has triggered
- **THEN** the action is hold
- **AND** the reason states that the extension is not a sell signal

### Requirement: Missing inputs stay blocked

A missing report, a missing price, or a bullish report without a complete buy range MUST be blocked. A prior close MUST still produce an action. Freshness MUST distinguish that close from the current session. The reason MUST stay a fact and MUST NOT add a disclaimer.

#### Scenario: Yesterday's close still decides

- **WHEN** the only available price is a close from a date before the current Shanghai date
- **THEN** the action is not blocked for the date alone
- **AND** the reason does not say the price is not a live session price

### Requirement: Recorded passes stay out of the win rate

A recorded pass MUST be stored for the authenticated user and MUST NOT change open lots, closed slices, realized price difference, or win rate. Win rate MUST remain absent until at least six directional closed slices exist.

#### Scenario: Pass does not close a lot

- **WHEN** a pass is recorded for a stock that also has an open buy
- **THEN** the open quantity is unchanged
- **AND** the pass is excluded from the win-rate sample
