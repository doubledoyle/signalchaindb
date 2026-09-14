"use client";

import {useMemo, useState} from "react";
import type {Product, Compatibility, PowerSupplyOutput} from "@/lib/types";
import {Badge} from "./Badge";

const prettyType = (value: string) => value.replaceAll("_", " ");

const itemPowerSummary = (product: Product) => {
  const parts: string[] = [];

  if (product.voltage_v) parts.push(`${product.voltage_v}V`);
  if (product.current_ma) parts.push(`${product.current_ma}mA`);
  if (product.polarity && product.polarity !== "unknown") parts.push(product.polarity);

  if (parts.length) return parts.join(" · ");

  if (product.category === "Power Supply") return "Power supply";
  if (product.category === "Power Accessory") return "Power accessory";
  if (product.category === "Pedalboard") return "Pedalboard / physical fit";

  return "Power specs not recorded";
};

const dependencyLabel = (product: Product) => `${product.brand} ${product.name}`;


const normalizedPolarity = (value?: string | null) => (value || "").trim().toLowerCase();

const deviceClearlyNeedsDc = (product: Product) => {
  const polarity = normalizedPolarity(product.polarity);
  return polarity === "center-negative" || polarity === "center-positive";
};

const outputIsAc = (output: PowerSupplyOutput) => normalizedPolarity(output.polarity) === "ac";

const outputCanFeedDeviceType = (product: Product, output: PowerSupplyOutput) =>
  !(deviceClearlyNeedsDc(product) && outputIsAc(output));

const normalizeConnector = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .replace(/barrel/g, "")
    .replace(/\s+/g, "")
    .replace(/×/g, "x")
    .trim();

function cableAssessment(product: Product, output: PowerSupplyOutput) {
  const devicePolarity = normalizedPolarity(product.polarity);
  const outputPolarity = normalizedPolarity(output.polarity);

  let polarity: "match" | "adapt" | "unknown" = "unknown";
  if (
    (devicePolarity === "center-negative" || devicePolarity === "center-positive") &&
    (outputPolarity === "center-negative" || outputPolarity === "center-positive")
  ) {
    polarity = devicePolarity === outputPolarity ? "match" : "adapt";
  }

  const deviceConnector = normalizeConnector(product.power_connector);
  const outputConnector = normalizeConnector(output.connector);
  let connector: "match" | "adapt" | "unknown" = "unknown";
  if (deviceConnector && outputConnector) {
    connector = deviceConnector === outputConnector ? "match" : "adapt";
  }

  return {polarity, connector};
}


function outputSlotLabel(outputGroup: string, index: number, quantity: number) {
  const range = outputGroup.match(/(?:outlets|outputs)\s+(\d+)\s*-\s*(\d+)/i);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (end - start + 1 >= quantity) return `Output ${start + index}`;
  }

  const single = outputGroup.match(/output\s+(\d+)/i);
  if (single && quantity === 1) return `Output ${single[1]}`;

  return quantity === 1 ? outputGroup : `${outputGroup} #${index + 1}`;
}

function namedDependencies(relation: Compatibility, products: Product[]) {
  const text = `${relation.requirements || ""} ${relation.notes || ""}`.toLowerCase();

  if (!text.trim()) return [];

  return products.filter((product) => {
    if (product.id === relation.source_id || product.id === relation.target_id) return false;

    const fullName = dependencyLabel(product).toLowerCase();
    const productName = product.name.toLowerCase();

    // Prefer exact brand + model mentions. For short model names such as DC7,
    // only count them when the brand is also present in the relationship text.
    if (text.includes(fullName)) return true;
    if (productName.length >= 5 && text.includes(productName)) return true;

    return false;
  });
}

export function RigBuilder({
  products,
  relations,
  powerOutputs,
}: {
  products: Product[];
  relations: Compatibility[];
  powerOutputs: PowerSupplyOutput[];
}) {
  const [selected, setSelected] = useState<number[]>([]);

  const available = products.filter((product) => !selected.includes(product.id));
  const add = (id: number) => setSelected((value) => [...value, id]);
  const remove = (id: number) => setSelected((value) => value.filter((x) => x !== id));

  const items = selected
    .map((id) => products.find((product) => product.id === id)!)
    .filter(Boolean);

  const totalCurrent = items.reduce((total, product) => total + (product.current_ma || 0), 0);
  const unknown = items.filter(
    (product) =>
      product.current_ma == null &&
      ["Effects Pedal", "Modeler / Multi-FX", "MIDI Controller"].includes(product.category),
  ).length;

  const knownRelations = useMemo(() => {
    const selectedIds = new Set(selected);
    return relations.filter(
      (relation) => selectedIds.has(relation.source_id) && selectedIds.has(relation.target_id),
    );
  }, [selected, relations]);

  const conflicts = knownRelations.filter((relation) => relation.status === "incompatible");
  const workingConnections = knownRelations.filter((relation) => relation.status !== "incompatible");

  const dependencyChecks = useMemo(() => {
    const selectedIds = new Set(selected);

    return workingConnections
      .map((relation) => {
        const dependencies = namedDependencies(relation, products);
        const missing = dependencies.filter((product) => !selectedIds.has(product.id));
        const present = dependencies.filter((product) => selectedIds.has(product.id));

        return {relation, dependencies, missing, present};
      })
      .filter((check) => check.dependencies.length > 0);
  }, [workingConnections, products, selected]);

  const missingDependencyChecks = dependencyChecks.filter((check) => check.missing.length > 0);

  const dependencyCheckForRelation = (relationId: number) =>
    dependencyChecks.find((check) => check.relation.id === relationId);

  const powerCapacityChecks = useMemo(() => {
    const selectedIds = new Set(selected);
    const selectedOutputs = powerOutputs.filter((output) => selectedIds.has(output.product_id));

    return items
      .filter(
        (product) =>
          product.category !== "Power Supply" &&
          product.voltage_v != null &&
          product.current_ma != null,
      )
      .map((product) => {
        const exactVoltage = selectedOutputs.filter(
          (output) => output.voltage_v === product.voltage_v,
        );
        const usableSameVoltage = exactVoltage.filter((output) =>
          outputCanFeedDeviceType(product, output),
        );
        const blockedAcOutputs = exactVoltage.filter((output) =>
          !outputCanFeedDeviceType(product, output),
        );
        const matches = usableSameVoltage.filter(
          (output) => output.current_ma >= product.current_ma!,
        );
        const bestSameVoltage = usableSameVoltage
          .slice()
          .sort((a, b) => b.current_ma - a.current_ma)[0];

        return {product, matches, bestSameVoltage, blockedAcOutputs};
      });
  }, [items, selected, powerOutputs]);

  const failedPowerCapacityChecks = powerCapacityChecks.filter((check) => check.matches.length === 0);

  const selectedPowerOutputGroups = useMemo(() => {
    const selectedIds = new Set(selected);
    const grouped = new Map<string, {
      product: Product;
      outputGroup: string;
      quantity: number;
      isolated: boolean;
      switchable: boolean;
      connector?: string | null;
      notes: string[];
      variants: PowerSupplyOutput[];
    }>();

    for (const output of powerOutputs) {
      if (!selectedIds.has(output.product_id)) continue;
      const product = products.find((item) => item.id === output.product_id);
      if (!product) continue;

      const key = `${output.product_id}:${output.output_group}`;
      const existing = grouped.get(key);
      if (existing) {
        existing.variants.push(output);
        if (output.notes && !existing.notes.includes(output.notes)) existing.notes.push(output.notes);
      } else {
        grouped.set(key, {
          product,
          outputGroup: output.output_group,
          quantity: output.quantity,
          isolated: Boolean(output.isolated),
          switchable: Boolean(output.switchable),
          connector: output.connector,
          notes: output.notes ? [output.notes] : [],
          variants: [output],
        });
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const productCompare = `${a.product.brand} ${a.product.name}`.localeCompare(
        `${b.product.brand} ${b.product.name}`,
      );
      return productCompare || a.outputGroup.localeCompare(b.outputGroup);
    });
  }, [selected, powerOutputs, products]);



  const powerAllocation = useMemo(() => {
    const slots = selectedPowerOutputGroups.flatMap((group) =>
      Array.from({length: group.quantity}, (_, index) => ({
        key: `${group.product.id}:${group.outputGroup}:${index}`,
        product: group.product,
        outputGroup: group.outputGroup,
        index,
        quantity: group.quantity,
        variants: group.variants,
      })),
    );

    const deviceCandidates = powerCapacityChecks
      .map(({product}) => ({
        product,
        candidates: slots.flatMap((slot) =>
          slot.variants
            .filter(
              (variant) =>
                variant.voltage_v === product.voltage_v &&
                variant.current_ma >= product.current_ma! &&
                outputCanFeedDeviceType(product, variant),
            )
            .map((variant) => ({slot, variant})),
        ),
      }))
      .sort((a, b) => {
        const optionDifference = a.candidates.length - b.candidates.length;
        if (optionDifference) return optionDifference;
        return (b.product.current_ma || 0) - (a.product.current_ma || 0);
      });

    const usedSlots = new Set<string>();
    const assignments: Array<{
      product: Product;
      slot: (typeof slots)[number];
      variant: PowerSupplyOutput;
    }> = [];
    const unassigned: Array<{
      product: Product;
      reason: "no_match" | "outputs_reserved";
    }> = [];

    for (const entry of deviceCandidates) {
      const availableCandidates = entry.candidates
        .filter(({slot}) => !usedSlots.has(slot.key))
        .sort((a, b) => {
          const headroomA = a.variant.current_ma - (entry.product.current_ma || 0);
          const headroomB = b.variant.current_ma - (entry.product.current_ma || 0);
          return headroomA - headroomB || a.slot.key.localeCompare(b.slot.key);
        });

      const chosen = availableCandidates[0];
      if (chosen) {
        usedSlots.add(chosen.slot.key);
        assignments.push({product: entry.product, slot: chosen.slot, variant: chosen.variant});
      } else {
        unassigned.push({
          product: entry.product,
          reason: entry.candidates.length > 0 ? "outputs_reserved" : "no_match",
        });
      }
    }

    assignments.sort((a, b) =>
      `${a.product.brand} ${a.product.name}`.localeCompare(`${b.product.brand} ${b.product.name}`),
    );
    unassigned.sort((a, b) =>
      `${a.product.brand} ${a.product.name}`.localeCompare(`${b.product.brand} ${b.product.name}`),
    );

    return {
      assignments,
      unassigned,
      totalSlots: slots.length,
      remainingSlots: slots.length - assignments.length,
    };
  }, [selectedPowerOutputGroups, powerCapacityChecks]);

  return (
    <div className="rig">
      <div className="rigAdd">
        <select
          defaultValue=""
          onChange={(event) => {
            if (event.target.value) {
              add(+event.target.value);
              event.currentTarget.value = "";
            }
          }}
        >
          <option value="">Add gear to rig…</option>
          {available.map((product) => (
            <option key={product.id} value={product.id}>
              {product.brand} — {product.name}
            </option>
          ))}
        </select>
      </div>

      <div className="rigStats">
        <div>
          <strong>{items.length}</strong>
          <span>items</span>
        </div>
        <div>
          <strong>{totalCurrent} mA</strong>
          <span>known current draw</span>
        </div>
        <div>
          <strong>{unknown}</strong>
          <span>power specs unknown</span>
        </div>
      </div>

      <div className="rigList">
        {items.length === 0 ? (
          <p className="muted">Add some pedals, a modeler, controller, or power supply.</p>
        ) : (
          items.map((product) => (
            <div className="rigItem" key={product.id}>
              <div>
                <b>
                  {product.brand} {product.name}
                </b>
                <span>{itemPowerSummary(product)}</span>
              </div>
              <button onClick={() => remove(product.id)}>Remove</button>
            </div>
          ))
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="warningBox">
          <b>Known conflicts</b>
          <div className="relationList" style={{marginTop: 10}}>
            {conflicts.map((relation) => (
              <div className="relation" key={relation.id}>
                <div>
                  <div className="eyebrow">{prettyType(relation.compatibility_type)}</div>
                  <h3>
                    {relation.source_brand} {relation.source_name} ↔ {relation.target_brand}{" "}
                    {relation.target_name}
                  </h3>
                  <p>
                    <b>Why:</b> {relation.requirements || relation.notes || "Stored as incompatible."}
                  </p>
                  {relation.notes && relation.requirements && <p>{relation.notes}</p>}
                  {relation.source_url && (
                    <p>
                      <a target="_blank" rel="noreferrer" href={relation.source_url}>
                        View recorded source ↗
                      </a>
                    </p>
                  )}
                </div>
                <div>
                  <Badge value={relation.status} />
                  <Badge value={relation.confidence} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {missingDependencyChecks.length > 0 && (
        <div className="warningBox" style={{marginTop: 18}}>
          <b>Missing required gear</b>
          <div className="relationList" style={{marginTop: 10}}>
            {missingDependencyChecks.map(({relation, missing}) => (
              <div className="relation" key={`dependency-${relation.id}`}>
                <div>
                  <div className="eyebrow">dependency check</div>
                  <h3>
                    {relation.source_brand} {relation.source_name} → {relation.target_brand}{" "}
                    {relation.target_name}
                  </h3>
                  <p>
                    This stored connection names <b>{missing.map(dependencyLabel).join(", ")}</b> as
                    required gear, but {missing.length === 1 ? "it is" : "they are"} not currently in
                    this rig.
                  </p>
                </div>
                <div>
                  <Badge value="compatible_with_conditions" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {powerCapacityChecks.length > 0 && (
        <div style={{marginTop: 22}}>
          <div className="sectionHead" style={{marginBottom: 12}}>
            <div>
              <span className="kicker">POWER CHECK</span>
              <h2 style={{fontSize: 28}}>Single-output capacity check</h2>
            </div>
          </div>

          {failedPowerCapacityChecks.length > 0 && (
            <div className="warningBox" style={{marginBottom: 12}}>
              <b>Power attention needed</b>
              <p className="muted small" style={{marginTop: 6}}>
                At least one device has no direct single-output voltage/current match among the
                selected power supplies.
              </p>
            </div>
          )}

          <div className="relationList">
            {powerCapacityChecks.map(({product, matches, bestSameVoltage, blockedAcOutputs}) => {
              const match = matches[0];
              const matchSupply = match
                ? products.find((item) => item.id === match.product_id)
                : undefined;
              const bestSupply = bestSameVoltage
                ? products.find((item) => item.id === bestSameVoltage.product_id)
                : undefined;

              return (
                <div className="relation" key={`power-check-${product.id}`}>
                  <div>
                    <div className="eyebrow">voltage / current</div>
                    <h3>
                      {product.brand} {product.name}
                    </h3>
                    <p>
                      <b>Requires:</b> {product.voltage_v}V / {product.current_ma}mA
                    </p>
                    {match && matchSupply ? (
                      <p>
                        <b>Direct match:</b> {matchSupply.brand} {matchSupply.name} — {match.voltage_v}V / {match.current_ma}mA
                      </p>
                    ) : bestSameVoltage && bestSupply ? (
                      <p>
                        <b>No direct single-output match:</b> best recorded {product.voltage_v}V output in this rig is {bestSupply.brand} {bestSupply.name} at {bestSameVoltage.current_ma}mA.
                      </p>
                    ) : blockedAcOutputs.length > 0 ? (
                      <p>
                        <b>No safe direct match:</b> the recorded same-voltage output is AC, while this device's structured polarity indicates DC power.
                      </p>
                    ) : (
                      <p>
                        <b>No direct single-output match:</b> no selected power supply has a recorded {product.voltage_v}V output.
                      </p>
                    )}
                  </div>
                  <div>
                    <Badge value={match ? "compatible" : "compatible_with_conditions"} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="muted small" style={{marginTop: 10}}>
            This check compares structured voltage/current and now prevents a recorded AC output from being treated as a direct match for a device that clearly requires center-positive or center-negative DC.
          </p>
        </div>
      )}


      {powerAllocation.totalSlots > 0 && powerCapacityChecks.length > 0 && (
        <div style={{marginTop: 22}}>
          <div className="sectionHead" style={{marginBottom: 12}}>
            <div>
              <span className="kicker">OUTLET PLAN</span>
              <h2 style={{fontSize: 28}}>Suggested physical-output allocation</h2>
            </div>
          </div>

          <div className="rigStats">
            <div>
              <strong>{powerAllocation.assignments.length}</strong>
              <span>outputs reserved</span>
            </div>
            <div>
              <strong>{powerAllocation.remainingSlots}</strong>
              <span>physical outputs unreserved</span>
            </div>
            <div>
              <strong>{powerAllocation.unassigned.length}</strong>
              <span>devices unassigned</span>
            </div>
          </div>

          {powerAllocation.unassigned.length > 0 && (
            <div className="warningBox" style={{marginBottom: 12}}>
              <b>Not every powered device can be assigned</b>
              <p className="muted small" style={{marginTop: 6}}>
                Rig Builder now reserves one physical output per assigned device. Devices below stay
                unassigned when no suitable output exists or all suitable outputs are already reserved.
              </p>
            </div>
          )}

          <div className="relationList">
            {powerAllocation.assignments.map(({product, slot, variant}) => (
              <div className="relation" key={`allocation-${product.id}`}>
                <div>
                  <div className="eyebrow">
                    {slot.product.brand} {slot.product.name} · {outputSlotLabel(slot.outputGroup, slot.index, slot.quantity)}
                  </div>
                  <h3>
                    {product.brand} {product.name}
                  </h3>
                  <p>
                    <b>Assign:</b> {variant.voltage_v}V / {variant.current_ma}mA
                  </p>
                  <p className="muted small">
                    Device requirement: {product.voltage_v}V / {product.current_ma}mA · current headroom: {variant.current_ma - (product.current_ma || 0)}mA
                  </p>
                </div>
                <div>
                  <Badge value="compatible" />
                </div>
              </div>
            ))}

            {powerAllocation.unassigned.map(({product, reason}) => (
              <div className="relation" key={`allocation-unassigned-${product.id}`}>
                <div>
                  <div className="eyebrow">unassigned power requirement</div>
                  <h3>
                    {product.brand} {product.name}
                  </h3>
                  <p>
                    <b>Requires:</b> {product.voltage_v}V / {product.current_ma}mA
                  </p>
                  <p>
                    {reason === "outputs_reserved"
                      ? "Suitable recorded outputs exist, but they are already reserved by other devices in this suggested plan."
                      : "No recorded physical output in the selected power gear can meet this structured voltage/current requirement."}
                  </p>
                </div>
                <div>
                  <Badge value="compatible_with_conditions" />
                </div>
              </div>
            ))}
          </div>

          <p className="muted small" style={{marginTop: 10}}>
            This is a suggested one-device-per-output allocation based on structured voltage/current data.
            Cable and polarity checks appear separately below; daisy chaining, current-doubler cables, and alternate power modes stored only in notes are not yet modeled.
          </p>
        </div>
      )}

      {powerAllocation.assignments.length > 0 && (
        <div style={{marginTop: 22}}>
          <div className="sectionHead" style={{marginBottom: 12}}>
            <div>
              <span className="kicker">CABLE / POLARITY CHECK</span>
              <h2 style={{fontSize: 28}}>Connection sanity check</h2>
            </div>
          </div>

          <div className="relationList">
            {powerAllocation.assignments.map(({product, slot, variant}) => {
              const assessment = cableAssessment(product, variant);
              const needsAttention =
                assessment.polarity !== "match" || assessment.connector !== "match";

              return (
                <div className="relation" key={`cable-${product.id}`}>
                  <div>
                    <div className="eyebrow">
                      {slot.product.brand} {slot.product.name} · {outputSlotLabel(slot.outputGroup, slot.index, slot.quantity)}
                    </div>
                    <h3>
                      {product.brand} {product.name}
                    </h3>
                    <p>
                      <b>Polarity:</b>{" "}
                      {assessment.polarity === "match"
                        ? `${product.polarity} direct match`
                        : assessment.polarity === "adapt"
                          ? `${product.polarity} device vs ${variant.polarity} output — polarity-reversing cable/adapter required`
                          : "cannot be fully validated from current structured data"}
                    </p>
                    <p>
                      <b>Connector:</b>{" "}
                      {assessment.connector === "match"
                        ? `${product.power_connector} direct match`
                        : assessment.connector === "adapt"
                          ? `${product.power_connector} device vs ${variant.connector} output — correct adapter/cable required`
                          : "cannot be fully validated from current structured data"}
                    </p>
                  </div>
                  <div>
                    <Badge value={needsAttention ? "compatible_with_conditions" : "compatible"} />
                  </div>
                </div>
              );
            })}
          </div>

          <p className="muted small" style={{marginTop: 10}}>
            A voltage/current match does not guarantee the cable is safe. This section checks structured polarity and connector data when both sides are recorded; unknown fields stay explicitly unverified rather than being guessed.
          </p>
        </div>
      )}


      {selectedPowerOutputGroups.length > 0 && (
        <div style={{marginTop: 22}}>
          <div className="sectionHead" style={{marginBottom: 12}}>
            <div>
              <span className="kicker">POWER OUTPUTS</span>
              <h2 style={{fontSize: 28}}>Available power in this rig</h2>
            </div>
          </div>
          <div className="relationList">
            {selectedPowerOutputGroups.map((group) => {
              const variants = [...group.variants].sort((a, b) => a.voltage_v - b.voltage_v);
              return (
                <div className="relation" key={`${group.product.id}-${group.outputGroup}`}>
                  <div>
                    <div className="eyebrow">{group.outputGroup}</div>
                    <h3>
                      {group.product.brand} {group.product.name}
                    </h3>
                    <p>
                      <b>{group.quantity}</b> physical {group.quantity === 1 ? "output" : "outputs"}
                      {group.isolated ? " · isolated" : ""}
                      {group.switchable ? " · switchable" : ""}
                    </p>
                    <p>
                      <b>Available settings:</b>{" "}
                      {variants
                        .map((variant) => `${variant.voltage_v}V / ${variant.current_ma}mA`)
                        .join(" · ")}
                    </p>
                    {group.connector && (
                      <p>
                        <b>Connector:</b> {group.connector}
                      </p>
                    )}
                    {group.notes.map((note) => (
                      <p className="muted small" key={note}>
                        {note}
                      </p>
                    ))}
                  </div>
                  <div>
                    <Badge value={group.isolated ? "official" : "unverified"} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {workingConnections.length > 0 && (
        <div style={{marginTop: 22}}>
          <div className="sectionHead" style={{marginBottom: 12}}>
            <div>
              <span className="kicker">KNOWN CONNECTIONS</span>
              <h2 style={{fontSize: 28}}>What SignalChainDB already knows about this rig</h2>
            </div>
          </div>
          <div className="relationList">
            {workingConnections.map((relation) => {
              const dependencyCheck = dependencyCheckForRelation(relation.id);

              return (
                <div className="relation" key={relation.id}>
                  <div>
                    <div className="eyebrow">{prettyType(relation.compatibility_type)}</div>
                    <h3>
                      {relation.source_brand} {relation.source_name} → {relation.target_brand}{" "}
                      {relation.target_name}
                    </h3>
                    <p>
                      <b>Requirements:</b> {relation.requirements || "None recorded."}
                    </p>
                    {dependencyCheck && dependencyCheck.dependencies.length > 0 && (
                      <p>
                        <b>Rig dependency:</b>{" "}
                        {dependencyCheck.missing.length > 0
                          ? `${dependencyCheck.missing.map(dependencyLabel).join(", ")} missing`
                          : `${dependencyCheck.present.map(dependencyLabel).join(", ")} present`}
                      </p>
                    )}
                    {relation.notes && <p>{relation.notes}</p>}
                    {relation.source_url && (
                      <p>
                        <a target="_blank" rel="noreferrer" href={relation.source_url}>
                          View recorded source ↗
                        </a>
                      </p>
                    )}
                  </div>
                  <div>
                    <Badge value={relation.status} />
                    <Badge value={relation.confidence} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="muted small" style={{marginTop: 18}}>
        Rig Builder totals known device current draw, surfaces stored compatibility relationships,
        flags known conflicts, checks required-gear dependencies, shows recorded power-supply output
        groups, checks direct voltage/current matches, suggests one-device-per-output assignments, and checks structured cable/polarity details without treating AC outputs as DC.
      </p>
    </div>
  );
}
