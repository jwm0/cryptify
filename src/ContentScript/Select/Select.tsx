import React from "react";

import { Modal } from "../Modal";

export type SelectProps = {
  options: { id: string; alias: string }[];
  handleSelect: (value: string) => void;
};

export const Select: React.FC<SelectProps> = ({ options, handleSelect }) => {
  return (
    <Modal>
      <select
        style={{
          backgroundColor: "#fff",
        }}
        onChange={({ target: { value } }) => {
          handleSelect(value);
        }}
        autoFocus
      >
        <option disabled selected value="">
          -- select conversation id --
        </option>
        {options.map(o => {
          return <option value={o.id}>{o.alias}</option>;
        })}
      </select>
    </Modal>
  );
};
