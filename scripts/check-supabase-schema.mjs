#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const REQUIRED_SQL_PATH = "supabase/property_ownership.sql";

function loadEnvFile(filePath) {
  const absolutePath = resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) return;

  const contents = readFileSync(absolutePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

function describeError(error) {
  if (!error) return "no error";

  const code = error.code ? `[${error.code}] ` : "";
  const message = error.message ?? String(error);
  const hint = error.hint ? ` Hint: ${error.hint}` : "";

  return `${code}${message}${hint}`;
}

function isMissingFunctionError(error) {
  return (
    error?.code === "PGRST202" ||
    /could not find.*function|function .* does not exist/i.test(
      error?.message ?? "",
    )
  );
}

function isExpectedProtectedRpcError(error) {
  return (
    error?.code === "42501" ||
    /permission denied|authentication is required|jwt|not authorized|unauthorized/i.test(
      error?.message ?? "",
    )
  );
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const failures = [];

if (!supabaseUrl || !supabaseAnonKey) {
  failures.push(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY in the environment.",
  );
}

if (!existsSync(resolve(process.cwd(), REQUIRED_SQL_PATH))) {
  failures.push(`Missing required SQL file: ${REQUIRED_SQL_PATH}`);
}

if (failures.length === 0) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const publicProperties = await supabase
    .from("public_properties")
    .select("id")
    .limit(1);

  if (publicProperties.error) {
    failures.push(
      [
        "public.public_properties is not queryable with the anon key.",
        describeError(publicProperties.error),
        `Run ${REQUIRED_SQL_PATH} in Supabase SQL Editor, then retry.`,
      ].join(" "),
    );
  } else {
    console.log("OK public.public_properties is queryable.");
  }

  for (const hiddenColumn of ["owner_clerk_id", "contact_whatsapp"]) {
    const hiddenColumnResult = await supabase
      .from("public_properties")
      .select(hiddenColumn)
      .limit(1);

    if (!hiddenColumnResult.error) {
      failures.push(
        `public.public_properties exposes forbidden column: ${hiddenColumn}`,
      );
    } else {
      console.log(`OK public_properties hides ${hiddenColumn}.`);
    }
  }

  const directProperties = await supabase
    .from("properties")
    .select("id,owner_clerk_id,contact_whatsapp")
    .limit(1);

  if (!directProperties.error) {
    failures.push(
      "Anonymous clients can still read public.properties directly. The public base-table SELECT grant/policy is still open.",
    );
  } else {
    console.log("OK anonymous direct reads from public.properties are blocked.");
  }

  const targetPropertyId = publicProperties.data?.[0]?.id ?? "schema-health-check";
  const contactRpc = await supabase.rpc("get_property_contact_whatsapp", {
    target_property_id: targetPropertyId,
  });

  if (!contactRpc.error) {
    failures.push(
      "Anonymous clients can call get_property_contact_whatsapp. Revoke anon execute and keep the auth check.",
    );
  } else if (isMissingFunctionError(contactRpc.error)) {
    failures.push(
      [
        "public.get_property_contact_whatsapp is missing from the Supabase API schema.",
        describeError(contactRpc.error),
        `Run ${REQUIRED_SQL_PATH} in Supabase SQL Editor, then reload the Supabase API schema cache if needed.`,
      ].join(" "),
    );
  } else if (!isExpectedProtectedRpcError(contactRpc.error)) {
    failures.push(
      [
        "public.get_property_contact_whatsapp exists, but did not fail with the expected protected/auth error for anon.",
        describeError(contactRpc.error),
      ].join(" "),
    );
  } else {
    console.log("OK contact RPC exists and is protected from anon clients.");
  }
}

if (failures.length > 0) {
  console.error("\nSupabase schema check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nSupabase schema check passed.");
