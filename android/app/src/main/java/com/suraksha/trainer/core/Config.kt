package com.suraksha.trainer.core

import com.suraksha.trainer.BuildConfig

/**
 * Central build-time configuration.
 *
 * The app is fully local/offline: all data lives in the on-device SQLite
 * database (Room). No server or cloud credentials are needed anywhere.
 */
object Config {
    val APP_TAG: String = BuildConfig.APP_TAG

    const val PASS_MARK_DEFAULT = 80
    const val HASH_CHAIN_DOMAIN = "suraksha-trainer/v1"
    const val CERT_MAX_RETRIES = 5
}