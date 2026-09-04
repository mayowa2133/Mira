/* eslint-disable */
// ---------------------------------------------------------------------------
// GENERATED FILE — DO NOT EDIT.
//
// Source:     docs/05-api/openapi.yaml
// Regenerate: npm run generate:api-types
// ---------------------------------------------------------------------------

export interface paths {
    "/auth/session": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Exchange a provider token for a Mira session */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        provider: "apple" | "google" | "email";
                        token: string;
                    };
                };
            };
            responses: {
                /** @description Session created */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Session"];
                    };
                };
                401: components["responses"]["Unauthorized"];
            };
        };
        /** Sign out */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Signed out */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Current user */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The authenticated user */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["User"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/auth/account": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete the account and all associated private data */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deletion scheduled */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JobAccepted"];
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/closet": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Closet summary */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Counts and recent additions */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ClosetSummary"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/garments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List garments */
        get: {
            parameters: {
                query?: {
                    category?: string[];
                    subcategory?: string[];
                    brand_id?: string[];
                    color?: string[];
                    size?: string[];
                    season?: string[];
                    occasion?: string[];
                    material?: string[];
                    style_tag?: string[];
                    retailer?: string[];
                    status?: components["schemas"]["GarmentStatus"][];
                    favorite?: boolean;
                    tags_attached?: boolean;
                    never_worn?: boolean;
                    not_worn_since_days?: number;
                    purchased_after?: string;
                    purchased_before?: string;
                    price_min?: number;
                    price_max?: number;
                    sort?: "recent" | "recently_worn" | "never_worn" | "brand" | "color" | "price_desc" | "price_asc";
                    cursor?: components["parameters"]["Cursor"];
                    limit?: components["parameters"]["Limit"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description A page of garments */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GarmentPage"];
                    };
                };
            };
        };
        put?: never;
        /** Create a garment */
        post: {
            parameters: {
                query?: never;
                header: {
                    "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["GarmentCreate"];
                };
            };
            responses: {
                /** @description Merged into an existing garment. Nothing was created, so the client must not add a second tile for a piece it is already showing. */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Garment"];
                    };
                };
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Garment"];
                    };
                };
                409: components["responses"]["Conflict"];
                422: components["responses"]["ValidationError"];
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/garments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        /** Get a garment */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The garment */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Garment"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        put?: never;
        post?: never;
        /** Remove a garment (soft delete) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Removed */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        /**
         * Update a garment
         * @description source.type is immutable and MUST be rejected if present.
         */
        patch: {
            parameters: {
                query?: never;
                header?: {
                    /** @description The garment's updatedAt value, for optimistic concurrency. */
                    "If-Match"?: string;
                };
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["GarmentUpdate"];
                };
            };
            responses: {
                /** @description Updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Garment"];
                    };
                };
                404: components["responses"]["NotFound"];
                409: components["responses"]["Conflict"];
            };
        };
        trace?: never;
    };
    "/garments/{id}/favorite": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Set favourite state */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        favorite: boolean;
                    };
                };
            };
            responses: {
                /** @description Updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Garment"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/garments/{id}/status": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Set garment status */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        status: components["schemas"]["GarmentStatus"];
                    };
                };
            };
            responses: {
                /** @description Updated */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Garment"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/garments/{id}/goes-with": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        /** Owned garments that pair well with this one */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Suggestions from the user's own closet */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GarmentPage"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/garments/{id}/similar": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        /** Visually similar owned garments */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Similar garments */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GarmentPage"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/garments/analyze": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Analyze an uploaded garment photo */
        post: {
            parameters: {
                query?: never;
                header: {
                    "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        upload_key: string;
                        /** @enum {string} */
                        source_type?: "camera" | "photo_library";
                    };
                };
            };
            responses: {
                /** @description Analysis queued; the garment exists in an analyzing state */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GarmentAccepted"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/garments/tag-scan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Identify a garment from a tag, barcode or SKU */
        post: {
            parameters: {
                query?: never;
                header: {
                    "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        upload_key?: string;
                        barcode?: string;
                        sku?: string;
                    };
                };
            };
            responses: {
                /** @description Confident identification */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TagIdentification"];
                    };
                };
                /** @description Queued for analysis */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GarmentAccepted"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/garments/check-duplicate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Check whether a garment about to be created already exists
         * @description Called by every ingestion path before creation.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["DuplicateCheckRequest"];
                };
            };
            responses: {
                /** @description Duplicate candidates, most likely first */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            candidates?: components["schemas"]["DuplicateCandidate"][];
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/media/upload-url": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Get a scoped, short-lived upload URL */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** @enum {string} */
                        purpose: "garment" | "body" | "receipt";
                        content_type: string;
                    };
                };
            };
            responses: {
                /** @description Upload target */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** Format: uri */
                            upload_url?: string;
                            upload_key?: string;
                            /** Format: date-time */
                            expires_at?: string;
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/imports/photo": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Import a garment from an uploaded photo */
        post: {
            parameters: {
                query?: never;
                header: {
                    "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        upload_key: string;
                    };
                };
            };
            responses: {
                /** @description Accepted */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["GarmentAccepted"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/imports/receipt": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Import garments from a receipt */
        post: {
            parameters: {
                query?: never;
                header: {
                    "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        upload_key: string;
                    };
                };
            };
            responses: {
                /** @description Accepted */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JobAccepted"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/imports/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        /** Import status and extracted items */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The import */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Import"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/imports/{id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create garments from selected extracted items */
        post: {
            parameters: {
                query?: never;
                header: {
                    "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                };
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        selected_item_ids: string[];
                    };
                };
            };
            responses: {
                /** @description Garments created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            garments?: components["schemas"]["Garment"][];
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/purchase-candidates": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List purchase candidates
         * @description Candidates are NOT garments and never appear in closet responses.
         */
        get: {
            parameters: {
                query?: {
                    status?: components["schemas"]["PurchaseCandidateStatus"][];
                    retailer?: string;
                    cursor?: components["parameters"]["Cursor"];
                    limit?: components["parameters"]["Limit"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description A page of candidates */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data?: components["schemas"]["PurchaseCandidate"][];
                            next_cursor?: string | null;
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/purchase-candidates/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Candidate counts by retailer and status */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Summary */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            total?: number;
                            by_retailer?: {
                                retailer?: string;
                                count?: number;
                            }[];
                            by_status?: {
                                [key: string]: number;
                            };
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/purchase-candidates/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Set candidate status
         * @description Only a transition to confirmed_owned creates a garment. Every other
         *     status leaves the closet unchanged.
         */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        status: components["schemas"]["PurchaseCandidateStatus"];
                    };
                };
            };
            responses: {
                /** @description Updated candidate, with linkedGarmentId when one was created */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PurchaseCandidate"];
                    };
                };
            };
        };
        trace?: never;
    };
    "/integrations/email": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List email connections
         * @description Tokens are never returned.
         */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Connections */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EmailConnection"][];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/integrations/email/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Disconnect an email account */
        delete: {
            parameters: {
                query?: {
                    delete_candidates?: boolean;
                };
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Disconnected */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/closet/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Search the closet
         * @description Always returns the interpretation, so the user can correct it.
         */
        get: {
            parameters: {
                query: {
                    q: string;
                    cursor?: components["parameters"]["Cursor"];
                    limit?: components["parameters"]["Limit"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Results plus interpretation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SearchResult"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/outfits": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List outfits */
        get: {
            parameters: {
                query?: {
                    tab?: "saved" | "worn" | "mira" | "mine";
                    cursor?: components["parameters"]["Cursor"];
                    limit?: components["parameters"]["Limit"];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description A page of outfits */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            data?: components["schemas"]["Outfit"][];
                            next_cursor?: string | null;
                        };
                    };
                };
            };
        };
        put?: never;
        /** Create an outfit */
        post: {
            parameters: {
                query?: never;
                header: {
                    "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        name?: string | null;
                        occasion?: string | null;
                        items: {
                            slot: components["schemas"]["OutfitSlot"];
                            /** Format: uuid */
                            garment_id: string;
                        }[];
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Outfit"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/outfits/generate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Ask Mira to style an outfit
         * @description Every returned garment id is validated against a server-built candidate
         *     set of the user's eligible garments. Garments that are not owned, or not
         *     outfit-eligible, can never appear in a proposal.
         */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        prompt?: string;
                        vibe?: string[];
                        /** @enum {string} */
                        priority?: "something_new" | "havent_worn_lately" | "favourite_pieces" | "surprise_me";
                        /** Format: uuid */
                        anchor_garment_id?: string | null;
                        /** @default 3 */
                        count?: number;
                    };
                };
            };
            responses: {
                /** @description Proposals */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            /** Format: uuid */
                            recommendation_id?: string;
                            looks?: components["schemas"]["OutfitProposal"][];
                        };
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/outfits/{id}/swap": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Swap one slot in an outfit */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        slot: components["schemas"]["OutfitSlot"];
                        /** Format: uuid */
                        garment_id: string;
                    };
                };
            };
            responses: {
                /** @description Updated outfit */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Outfit"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/wear-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Record a wear */
        post: {
            parameters: {
                query?: never;
                header: {
                    "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        garment_id?: string | null;
                        /** Format: uuid */
                        outfit_id?: string | null;
                        /** Format: date */
                        worn_on: string;
                    };
                };
            };
            responses: {
                /** @description Recorded */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WearEvent"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/body-profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the body profile */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The profile */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BodyProfile"];
                    };
                };
                404: components["responses"]["NotFound"];
            };
        };
        /** Create or update the body profile */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        height_cm?: number | null;
                        usual_sizes?: {
                            [key: string]: string;
                        };
                        fit_preferences?: {
                            [key: string]: string;
                        };
                    };
                };
            };
            responses: {
                /** @description Saved */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BodyProfile"];
                    };
                };
            };
        };
        post?: never;
        /** Delete the body profile and all its images */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deleted */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/try-on": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Generate a try-on
         * @description Returns an existing generation when the input fingerprint matches.
         */
        post: {
            parameters: {
                query?: never;
                header: {
                    "Idempotency-Key": components["parameters"]["IdempotencyKey"];
                };
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": {
                        /** Format: uuid */
                        outfit_id: string;
                        /** Format: uuid */
                        body_profile_id: string;
                    };
                };
            };
            responses: {
                /** @description Cache hit */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TryOnGeneration"];
                    };
                };
                /** @description Generation queued */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TryOnGeneration"];
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/try-on/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        /** Get a try-on generation */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The generation */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TryOnGeneration"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Delete a try-on generation permanently */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Deleted */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/wardrobe/insights": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Wardrobe insights */
        get: {
            parameters: {
                query?: {
                    kinds?: ("forgotten" | "never_worn" | "tags_attached" | "most_loved" | "similar_owned" | "cost_per_wear" | "closet_value")[];
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description Insights with hydrated garments */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": {
                            insights?: Record<string, unknown>[];
                        };
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/jobs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: components["parameters"]["Id"];
            };
            cookie?: never;
        };
        /** Job status */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: components["parameters"]["Id"];
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description The job */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Job"];
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Error: {
            error: {
                code: string;
                message: string;
                details?: {
                    field?: string;
                    issue?: string;
                }[];
                request_id?: string;
                retry_after?: number | null;
            };
        };
        Session: {
            access_token?: string;
            refresh_token?: string;
            /** Format: date-time */
            expires_at?: string;
            user?: components["schemas"]["User"];
        };
        User: {
            /** Format: uuid */
            id?: string;
            /** Format: email */
            email?: string | null;
            display_name?: string | null;
            avatar_url?: string | null;
            /** @enum {string} */
            onboarding_state?: "not_started" | "in_progress" | "completed" | "skipped";
            auto_import_enabled?: boolean;
        };
        Money: {
            amount?: number;
            currency?: string;
        };
        /** @enum {string} */
        GarmentStatus: "active" | "laundry" | "unavailable" | "lent_out" | "returned" | "sold" | "donated" | "lost" | "archived";
        /** @enum {string} */
        SourceType: "manual" | "camera" | "photo_library" | "tag_scan" | "barcode" | "receipt" | "email" | "retailer_integration" | "product_url" | "order_screenshot";
        /** @enum {string} */
        PurchaseCandidateStatus: "detected" | "processing" | "needs_review" | "confirmed_owned" | "returned" | "not_mine" | "removed" | "uncertain" | "ignored";
        /** @enum {string} */
        OutfitSlot: "top" | "bottom" | "dress" | "layer" | "shoes" | "bag" | "accessory";
        /** @enum {string} */
        ImageKind: "canonical" | "original" | "cleaned" | "front" | "back" | "side" | "detail" | "retailer";
        GarmentImage: {
            /** Format: uuid */
            id?: string;
            kind?: components["schemas"]["ImageKind"];
            /** Format: uri */
            url?: string;
            /** Format: uri */
            thumb_url?: string | null;
            /** Format: uri */
            medium_url?: string | null;
            /** Format: date-time */
            url_expires_at?: string;
            width?: number | null;
            height?: number | null;
            blurhash?: string | null;
            is_canonical?: boolean;
            position?: number;
        };
        Brand: {
            /** Format: uuid */
            id?: string;
            name?: string;
            logo_url?: string | null;
        };
        Garment: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            closet_id?: string;
            name?: string | null;
            brand?: components["schemas"]["Brand"];
            brand_raw?: string | null;
            /** @description taxonomy §1 */
            category: string;
            subcategory?: string | null;
            primary_color?: string | null;
            secondary_colors?: string[];
            pattern?: string | null;
            materials?: string[];
            size?: {
                raw?: string | null;
                normalized?: string | null;
                system?: string | null;
            };
            fit?: string | null;
            season?: string[];
            occasion?: string[];
            style_tags?: string[];
            purchase?: {
                /** Format: date */
                date?: string | null;
                price?: components["schemas"]["Money"];
                retailer?: string | null;
            };
            identifiers?: {
                sku?: string | null;
                barcode?: string | null;
                product_url?: string | null;
            };
            /** @description Immutable provenance. */
            source: {
                type?: components["schemas"]["SourceType"];
                reference?: string | null;
            };
            status: components["schemas"]["GarmentStatus"];
            favorite?: boolean;
            tags_attached?: boolean | null;
            notes?: string | null;
            wear?: {
                count?: number;
                /** Format: date-time */
                last_worn_at?: string | null;
                cost_per_wear?: components["schemas"]["Money"];
            };
            images?: components["schemas"]["GarmentImage"][];
            canonical_image?: components["schemas"]["GarmentImage"];
            /** @enum {string} */
            analysis_state?: "pending" | "analyzing" | "complete" | "failed" | "skipped";
            confidence?: {
                [key: string]: number;
            };
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        GarmentCreate: {
            name?: string | null;
            brand_raw?: string | null;
            category: string;
            subcategory?: string | null;
            primary_color?: string | null;
            secondary_colors?: string[];
            pattern?: string | null;
            materials?: string[];
            size_raw?: string | null;
            fit?: string | null;
            season?: string[];
            occasion?: string[];
            style_tags?: string[];
            /** Format: date */
            purchase_date?: string | null;
            purchase_price?: number | null;
            currency?: string | null;
            retailer?: string | null;
            sku?: string | null;
            barcode?: string | null;
            product_url?: string | null;
            source_type?: components["schemas"]["SourceType"];
            source_reference?: string | null;
            image_upload_keys?: string[];
            tags_attached?: boolean | null;
            notes?: string | null;
            duplicate_resolution?: components["schemas"]["DuplicateResolution"];
        };
        GarmentUpdate: components["schemas"]["GarmentCreate"] & Record<string, unknown>;
        GarmentPage: {
            data?: components["schemas"]["Garment"][];
            next_cursor?: string | null;
            total?: number | null;
        };
        GarmentAccepted: {
            /** Format: uuid */
            garment_id?: string;
            /** Format: uuid */
            job_id?: string;
        };
        JobAccepted: {
            /** Format: uuid */
            job_id?: string;
        };
        Job: {
            /** Format: uuid */
            id?: string;
            job_type?: string;
            /** @enum {string} */
            status?: "queued" | "running" | "complete" | "failed" | "cancelled";
            attempts?: number;
            error_code?: string | null;
            entity_type?: string | null;
            /** Format: uuid */
            entity_id?: string | null;
        };
        ClosetSummary: {
            total?: number;
            by_category?: {
                category?: string;
                count?: number;
            }[];
            recently_added?: components["schemas"]["Garment"][];
        };
        TagIdentification: {
            matched?: boolean;
            brand?: string | null;
            product_name?: string | null;
            color?: string | null;
            size?: string | null;
            sku?: string | null;
            barcode?: string | null;
            confidence?: number;
        };
        DuplicateCheckRequest: components["schemas"]["GarmentCreate"];
        DuplicateCandidate: {
            existing_garment?: components["schemas"]["Garment"];
            score?: number;
            /** @enum {string} */
            band?: "ask" | "ask_softly" | "note";
            summary?: string;
            signals?: ("barcode" | "sku_retailer" | "product_url" | "order_line" | "image_hash" | "visual_similarity" | "brand_name" | "category_color_size_brand" | "purchase_window")[];
        };
        DuplicateResolution: {
            /** Format: uuid */
            garment_id: string;
            /** @enum {string} */
            relation: "same_item" | "owns_two" | "different";
        };
        Import: {
            /** Format: uuid */
            id?: string;
            /** @enum {string} */
            kind?: "photo" | "receipt" | "email" | "product_url";
            /** @enum {string} */
            status?: "pending" | "parsing" | "needs_review" | "complete" | "failed";
            retailer?: string | null;
            /** Format: date */
            purchase_date?: string | null;
            items?: {
                id?: string;
                raw_name?: string;
                product_name?: string | null;
                price?: components["schemas"]["Money"];
                is_clothing?: boolean;
                suggested_category?: string | null;
                confidence?: number;
            }[];
            error_code?: string | null;
        };
        PurchaseCandidate: {
            /** Format: uuid */
            id?: string;
            source?: {
                /** @enum {string} */
                type?: "email" | "receipt" | "retailer_integration" | "order_screenshot";
                id?: string;
            };
            retailer?: string | null;
            order_number?: string | null;
            /** Format: date */
            purchase_date?: string | null;
            price?: components["schemas"]["Money"];
            raw_item_name?: string;
            product_name?: string | null;
            brand?: string | null;
            identifiers?: {
                sku?: string | null;
                barcode?: string | null;
                product_url?: string | null;
            };
            image_url?: string | null;
            match_confidence?: number | null;
            status?: components["schemas"]["PurchaseCandidateStatus"];
            /** Format: uuid */
            linked_garment_id?: string | null;
            /** Format: date-time */
            created_at?: string;
        };
        /** @description Tokens are never included. */
        EmailConnection: {
            /** Format: uuid */
            id?: string;
            /** @enum {string} */
            provider?: "gmail" | "outlook";
            /** Format: email */
            email_address?: string;
            /** @enum {string} */
            status?: "active" | "expired" | "revoked" | "error";
            /** Format: date-time */
            last_scan_at?: string | null;
        };
        SearchResult: {
            /** @description What Mira understood, rendered as removable chips. */
            interpretation?: {
                filters?: Record<string, unknown>;
                semantic_terms?: string[];
                sort?: string | null;
            };
            garments?: components["schemas"]["Garment"][];
            next_cursor?: string | null;
            total?: number | null;
        };
        Outfit: {
            /** Format: uuid */
            id?: string;
            name?: string | null;
            occasion?: string | null;
            season?: string[];
            /** @enum {string} */
            origin?: "user" | "mira";
            items?: {
                slot?: components["schemas"]["OutfitSlot"];
                garment?: components["schemas"]["Garment"];
                position?: number;
            }[];
            cover_image_url?: string | null;
            favorite?: boolean;
            wear?: {
                count?: number;
                /** Format: date-time */
                last_worn_at?: string | null;
            };
            /** Format: date-time */
            created_at?: string;
            /** Format: date-time */
            updated_at?: string;
        };
        OutfitProposal: {
            title?: string;
            rationale?: string | null;
            items?: {
                slot?: components["schemas"]["OutfitSlot"];
                /** Format: uuid */
                garment_id?: string;
            }[];
            missing_slots?: components["schemas"]["OutfitSlot"][];
        };
        WearEvent: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            garment_id?: string | null;
            /** Format: uuid */
            outfit_id?: string | null;
            /** Format: date */
            worn_on?: string;
            /** Format: date-time */
            created_at?: string;
        };
        /** @description Private. Never included in any other response. */
        BodyProfile: {
            /** Format: uuid */
            id?: string;
            height_cm?: number | null;
            usual_sizes?: {
                [key: string]: string;
            };
            fit_preferences?: {
                [key: string]: string;
            };
            images?: {
                /** Format: uuid */
                id?: string;
                /** @enum {string} */
                kind?: "front" | "side" | "back" | "reference";
                /** Format: uri */
                url?: string;
                /** Format: date-time */
                url_expires_at?: string;
            }[];
            is_active?: boolean;
            /** Format: date-time */
            created_at?: string;
        };
        TryOnGeneration: {
            /** Format: uuid */
            id?: string;
            /** Format: uuid */
            outfit_id?: string | null;
            /** Format: uuid */
            body_profile_id?: string;
            /** @enum {string} */
            status?: "queued" | "generating" | "complete" | "failed";
            /** Format: uri */
            image_url?: string | null;
            /** Format: date-time */
            url_expires_at?: string | null;
            garments?: {
                /** Format: uuid */
                id?: string;
                name?: string | null;
                brand?: string | null;
            }[];
            favorite?: boolean;
            rating?: number | null;
            error_code?: string | null;
            /** Format: date-time */
            created_at?: string;
        };
    };
    responses: {
        /** @description Missing or invalid credentials */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Not found, or not the caller's resource */
        NotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Concurrency or idempotency conflict */
        Conflict: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
        /** @description Request failed validation */
        ValidationError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["Error"];
            };
        };
    };
    parameters: {
        Id: string;
        Cursor: string;
        Limit: number;
        IdempotencyKey: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
