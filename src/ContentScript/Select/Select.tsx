import React from "react";

import { Modal } from "../Modal";

export type SelectProps = {
  options: { id: string; alias: string }[];
  handleSelect: (value: string) => void;
};

export const Select: React.FC<SelectProps> = ({ options, handleSelect }) => {
  return (
    <Modal
      header="Select conversation partner"
      description="If you can't find it, make sure to start a new conversation first!"
    >
      <select
        style={{
          backgroundColor: "#fff",
        }}
        onChange={({ target: { value } }) => {
          handleSelect(value);
        }}
        defaultValue=""
        autoFocus
      >
        <option disabled value="">
          -- select conversation id --
        </option>
        {options.map((o, i) => {
          return (
            <option key={i} value={o.id}>
              {o.alias}
            </option>
          );
        })}
      </select>
    </Modal>
  );
};
