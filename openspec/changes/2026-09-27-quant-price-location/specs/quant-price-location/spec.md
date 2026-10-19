# quant-price-location

## ADDED Requirements

### Requirement: Watchlist price location

The system MUST compare each current user's watchlist name with that user's latest saved research report and the latest shared daily close. A bullish report with a finite buy range MUST be classified as inside, below, or above. Any other recommendation MUST stay `not-buying`. Missing reports, closes, and ranges MUST stay visible and MUST NOT be filled with derived prices.

#### Scenario: In-range bullish close ranks first

- **WHEN** one bullish report has a close inside its saved range and another bullish report has a close below its saved range
- **THEN** the inside location is ordered before the below location
- **AND** neither row is labeled as an order
