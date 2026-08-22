/**
 * useActiveTestCard — wires the shared TestConfigCard to the TestsTab state.
 */
import type { ReactNode } from "react";
import { TestConfigCard } from "./TestConfigCard";
import type { TestConfigCardProps } from "./TestConfigCard";

export function useActiveTestCard(args: TestConfigCardProps): ReactNode {
  return (
    <TestConfigCard
      activeTestKey={args.activeTestKey}
      computed={args.computed}
      categoricalCols={args.categoricalCols}
      corrMethod={args.corrMethod}
      setCorrMethod={args.setCorrMethod}
      corrColA={args.corrColA}
      setTestCol1={args.setTestCol1}
      corrColB={args.corrColB}
      setTestCol2={args.setTestCol2}
      tType={args.tType}
      setTType={args.setTType}
      displayTCol1={args.displayTCol1}
      setTCol1={args.setTCol1}
      displayTCol2={args.displayTCol2}
      setTCol2={args.setTCol2}
      tMu={args.tMu}
      setTMu={args.setTMu}
      displayAnovaY={args.displayAnovaY}
      setAnovaY={args.setAnovaY}
      displayAnovaGroup={args.displayAnovaGroup}
      setAnovaGroup={args.setAnovaGroup}
      displayRegY={args.displayRegY}
      setRegY={args.setRegY}
      displayRegX={args.displayRegX}
      setRegX={args.setRegX}
      displayVifCols={args.displayVifCols}
      setVifCols={args.setVifCols}
      displayMwGroupCol={args.displayMwGroupCol}
      setMwGroupCol={args.setMwGroupCol}
      setMwG1={args.setMwG1}
      setMwG2={args.setMwG2}
      displayMwCol={args.displayMwCol}
      setMwCol={args.setMwCol}
      displayMwGroups={args.displayMwGroups}
      displayMwG1={args.displayMwG1}
      setMwG1Value={args.setMwG1Value}
      displayMwG2={args.displayMwG2}
      setMwG2Value={args.setMwG2Value}
      displayKwGroup={args.displayKwGroup}
      setKwGroup={args.setKwGroup}
      displayKwCol={args.displayKwCol}
      setKwCol={args.setKwCol}
      displayChiCol1={args.displayChiCol1}
      setChiCol1={args.setChiCol1}
      displayChiCol2={args.displayChiCol2}
      setChiCol2={args.setChiCol2}
      displayFisherCol1={args.displayFisherCol1}
      setFisherCol1={args.setFisherCol1}
      displayFisherCol2={args.displayFisherCol2}
      setFisherCol2={args.setFisherCol2}
    />
  );
}
