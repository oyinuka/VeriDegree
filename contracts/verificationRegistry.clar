 
;; VeriDegree VerificationRegistry Contract
;; Clarity v2
;; Tracks and logs verification requests and outcomes for credentials

;; Error codes
(define-constant ERR-NOT-AUTHORIZED u300)
(define-constant ERR-CREDENTIAL-NOT-FOUND u301)
(define-constant ERR-CREDENTIAL-REVOKED u302)
(define-constant ERR-NO-ACCESS u303)
(define-constant ERR-PAUSED u304)
(define-constant ERR-BATCH-LIMIT-EXCEEDED u305)
(define-constant ERR-INVALID-NFT-CONTRACT u306)
(define-constant ERR-INVALID-ACCESS-CONTRACT u307)

;; Contract metadata
(define-constant CONTRACT-NAME "VeriDegree Verification Registry")
(define-constant MAX-BATCH-SIZE u10) ;; Max verifications in one batch

;; Admin and contract state
(define-data-var admin principal tx-sender)
(define-data-var paused bool false)
(define-data-var nft-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var access-control-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var request-counter uint u0)

;; Verification request structure
(define-map verification-requests uint
  {
    credential-id: uint,
    verifier: principal,
    request-time: uint,
    is-verified: bool,
    verification-time: (optional uint)
  }
)

;; Private helper: is-admin
(define-private (is-admin)
  (is-eq tx-sender (var-get admin))
)

;; Private helper: ensure not paused
(define-private (ensure-not-paused)
  (asserts! (not (var-get paused)) (err ERR-PAUSED))
)

;; Set NFT contract address
(define-public (set-nft-contract (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-INVALID-NFT-CONTRACT))
    (var-set nft-contract contract)
    (ok true)
  )
)

;; Set access control contract address
(define-public (set-access-control-contract (contract principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq contract 'SP000000000000000000002Q6VF78)) (err ERR-INVALID-ACCESS-CONTRACT))
    (var-set access-control-contract contract)
    (ok true)
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (is-eq new-admin 'SP000000000000000000002Q6VF78)) (err ERR-NOT-AUTHORIZED))
    (var-set admin new-admin)
    (ok true)
  )
)

;; Pause/unpause the contract
(define-public (set-paused (pause bool))
  (begin
    (asserts! (is-admin) (err ERR-NOT-AUTHORIZED))
    (var-set paused pause)
    (ok pause)
  )
)

;; Request verification for a credential
(define-public (request-verification (credential-id uint))
  (begin
    (ensure-not-paused)
    (asserts! (is-some (contract-call? (var-get nft-contract) get-credential credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (let
      (
        (credential (unwrap! (contract-call? (var-get nft-contract) get-credential credential-id) (err ERR-CREDENTIAL-NOT-FOUND)))
        (has-access (contract-call? (var-get access-control-contract) has-access credential-id tx-sender))
        (request-id (+ (var-get request-counter) u1))
      )
      (asserts! (not (get revoked credential)) (err ERR-CREDENTIAL-REVOKED))
      (asserts! (is-ok has-access) (err ERR-NO-ACCESS))
      (asserts! (get value has-access) (err ERR-NO-ACCESS))
      (map-set verification-requests request-id
        {
          credential-id: credential-id,
          verifier: tx-sender,
          request-time: block-height,
          is-verified: true,
          verification-time: (some block-height)
        }
      )
      (var-set request-counter request-id)
      (print { event: "verification-requested", request-id: request-id, credential-id: credential-id, verifier: tx-sender })
      (print { event: "verification-completed", request-id: request-id, is-verified: true })
      (ok request-id)
    )
  )
)

;; Batch request verifications for multiple credentials
(define-public (batch-request-verifications (credential-ids (list 10 uint)))
  (begin
    (ensure-not-paused)
    (asserts! (<= (len credential-ids) MAX-BATCH-SIZE) (err ERR-BATCH-LIMIT-EXCEEDED))
    (fold batch-request-verification-iter credential-ids
      { request-id: (var-get request-counter), success: true }
    )
  )
)

;; Private helper for batch verification
(define-private (batch-request-verification-iter
  (credential-id uint)
  (state { request-id: uint, success: bool }))
  (begin
    (asserts! (get success state) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-some (contract-call? (var-get nft-contract) get-credential credential-id)) (err ERR-CREDENTIAL-NOT-FOUND))
    (let
      (
        (credential (unwrap! (contract-call? (var-get nft-contract) get-credential credential-id) (err ERR-CREDENTIAL-NOT-FOUND)))
        (has-access (contract-call? (var-get access-control-contract) has-access credential-id tx-sender))
        (request-id (+ (get request-id state) u1))
      )
      (asserts! (not (get revoked credential)) (err ERR-CREDENTIAL-REVOKED))
      (asserts! (is-ok has-access) (err ERR-NO-ACCESS))
      (asserts! (get value has-access) (err ERR-NO-ACCESS))
      (map-set verification-requests request-id
        {
          credential-id: credential-id,
          verifier: tx-sender,
          request-time: block-height,
          is-verified: true,
          verification-time: (some block-height)
        }
      )
      (print { event: "verification-requested", request-id: request-id, credential-id: credential-id, verifier: tx-sender })
      (print { event: "verification-completed", request-id: request-id, is-verified: true })
      { request-id: request-id, success: true }
    )
  )
)

;; Read-only: get verification request
(define-read-only (get-verification-request (request-id uint))
  (ok (map-get? verification-requests request-id))
)

;; Read-only: get admin
(define-read-only (get-admin)
  (ok (var-get admin))
)

;; Read-only: get nft contract
(define-read-only (get-nft-contract)
  (ok (var-get nft-contract))
)

;; Read-only: get access control contract
(define-read-only (get-access-control-contract)
  (ok (var-get access-control-contract))
)

;; Read-only: check if paused
(define-read-only (is-paused)
  (ok (var-get paused))
)