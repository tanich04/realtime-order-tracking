-- Create the orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'delivered')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the notification function
CREATE OR REPLACE FUNCTION notify_orders_change()
RETURNS TRIGGER AS $$
DECLARE
    payload JSON;
BEGIN
    -- Construct a JSON payload with operation and row data
    IF TG_OP = 'DELETE' THEN
        payload = json_build_object(
            'operation', 'DELETE',
            'timestamp', CURRENT_TIMESTAMP,
            'old', row_to_json(OLD)
        );
    ELSE
        payload = json_build_object(
            'operation', TG_OP,
            'timestamp', CURRENT_TIMESTAMP,
            'new', row_to_json(NEW)
        );
    END IF;

    -- Send the notification via PostgreSQL's LISTEN/NOTIFY
    PERFORM pg_notify('orders_changed', payload::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS orders_change_trigger ON orders;

CREATE TRIGGER orders_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_orders_change();