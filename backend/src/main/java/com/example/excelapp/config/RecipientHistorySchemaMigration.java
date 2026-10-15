package com.example.excelapp.config;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Repairs the legacy primary key of recipients_history.
 *
 * The database trigger creates history_key from recipient data. A recipient can
 * legitimately receive the same value more than once, so history_key cannot be
 * the table's primary key. The history rows remain intact; only their technical
 * identifier is changed to an automatically generated numeric id.
 */
@Component
@Profile("!test")
public class RecipientHistorySchemaMigration {

    private final JdbcTemplate jdbcTemplate;

    public RecipientHistorySchemaMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    void migratePrimaryKey() {
        Boolean alreadyMigrated = jdbcTemplate.queryForObject(
                "SELECT EXISTS (" +
                        "SELECT 1 FROM information_schema.key_column_usage " +
                        "WHERE table_schema = current_schema() " +
                        "AND table_name = 'recipients_history' " +
                        "AND constraint_name = 'recipients_history_pkey' " +
                        "AND column_name = 'id')",
                Boolean.class
        );
        if (Boolean.TRUE.equals(alreadyMigrated)) {
            return;
        }

        jdbcTemplate.execute("ALTER TABLE recipients_history ADD COLUMN IF NOT EXISTS id BIGSERIAL");
        jdbcTemplate.execute("UPDATE recipients_history " +
                "SET id = nextval(pg_get_serial_sequence('recipients_history', 'id')) " +
                "WHERE id IS NULL");
        jdbcTemplate.execute("ALTER TABLE recipients_history ALTER COLUMN id SET NOT NULL");
        jdbcTemplate.execute("ALTER TABLE recipients_history DROP CONSTRAINT IF EXISTS recipients_history_pkey");
        jdbcTemplate.execute("ALTER TABLE recipients_history " +
                "ADD CONSTRAINT recipients_history_pkey PRIMARY KEY (id)");
    }
}
