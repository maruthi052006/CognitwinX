"""
Fine-tuning Pipeline for CognitwinX Domain-Specific LLM.
Optimized for Google Colab Free T4 GPU or Kaggle Notebooks (P100/T4).

Base Model: Llama-3.2-3B-Instruct (or Qwen2.5-1.5B-Instruct)
Method: QLoRA 4-bit NormalFloat (NF4) Quantization with PEFT LoRA
Hyperparameters (per CognitwinX Specification Section 8.3):
- LoRA Rank (r): 16
- LoRA Alpha: 32
- Target Modules: ["q_proj", "k_proj", "v_proj", "o_proj"]
- Epochs: 3
- Batch Size: 4
- Gradient Accumulation Steps: 4 (Effective batch size = 16)
- Learning Rate: 2e-4 (Cosine scheduler with warmup)
- Mixed Precision: fp16
- Output: LoRA adapter weights saved in `./cognitwinx_lora_adapters/`
"""
import os
import sys
import torch
from pathlib import Path
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments
)
from peft import (
    LoraConfig,
    get_peft_model,
    prepare_model_for_kbit_training,
    PeftModel
)
from trl import SFTTrainer, SFTConfig

BASE_MODEL_NAME = os.getenv("BASE_MODEL", "meta-llama/Llama-3.2-3B-Instruct")
FALLBACK_MODEL = "Qwen/Qwen2.5-1.5B-Instruct"
DATASET_DIR = Path(__file__).resolve().parent / "domain_dataset"
OUTPUT_DIR = Path(__file__).resolve().parent / "cognitwinx_lora_adapters"


def verify_environment():
    print("=" * 60)
    print("CognitwinX Domain LLM QLoRA Fine-Tuning Pipeline")
    print("=" * 60)
    print(f"CUDA Available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU Device: {torch.cuda.get_device_name(0)}")
        print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB")
    else:
        print("[INFO] Running in local CPU environment (AMD/Intel CPU, 8GB RAM).")
        print("\n[HARDWARE CONSTRAINT NOTE - Section 3]")
        print("Dedicated GPU (CUDA) is not available on this machine.")
        print("Per project specifications, domain LLM fine-tuning must be executed")
        print("on free cloud GPU services (Google Colab free T4 or Kaggle Notebooks).")
        print("Please run: backend/ml_training/finetune_domain_llm_colab.ipynb in Google Colab.")
        print("=" * 60)
        sys.exit(0)
    print("=" * 60)


def load_quantized_model_and_tokenizer(model_name):
    print(f"Loading base model: {model_name} with 4-bit NF4 quantization...")
    
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=True
    )
    
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)
    except Exception as e:
        print(f"Could not load tokenizer for {model_name}: {e}. Trying fallback: {FALLBACK_MODEL}")
        model_name = FALLBACK_MODEL
        tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)

    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config if torch.cuda.is_available() else None,
        device_map="auto" if torch.cuda.is_available() else None,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        trust_remote_code=True
    )

    model = prepare_model_for_kbit_training(model)
    return model, tokenizer, model_name


def get_lora_model(model):
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM"
    )
    peft_model = get_peft_model(model, lora_config)
    peft_model.print_trainable_parameters()
    return peft_model, lora_config


def formatting_func(example):
    """Formats ChatML or raw instruction into standard prompt format."""
    if "messages" in example and example["messages"]:
        text = ""
        for msg in example["messages"]:
            text += f"<|im_start|>{msg['role']}\n{msg['content']}<|im_end|>\n"
        return text
    else:
        inst = example.get("instruction", "")
        inp = example.get("input", "")
        out = example.get("output", "")
        full_inp = f"{inst}\nContext: {inp}" if inp else inst
        return f"<|im_start|>user\n{full_inp}<|im_end|>\n<|im_start|>assistant\n{out}<|im_end|>\n"


def main():
    verify_environment()
    train_file = DATASET_DIR / "train.jsonl"
    val_file = DATASET_DIR / "val.jsonl"

    if not train_file.exists():
        print(f"Dataset not found at {train_file}. Generating dataset first...")
        import generate_domain_dataset
        generate_domain_dataset.main()

    dataset = load_dataset(
        "json",
        data_files={"train": str(train_file), "validation": str(val_file)}
    )
    print(f"Loaded dataset: {len(dataset['train'])} train, {len(dataset['validation'])} val")

    model, tokenizer, chosen_model_name = load_quantized_model_and_tokenizer(BASE_MODEL_NAME)
    peft_model, lora_config = get_lora_model(model)

    training_args = SFTConfig(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=3,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=2e-4,
        lr_scheduler_type="cosine",
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        fp16=torch.cuda.is_available(),
        bf16=False,
        max_grad_norm=0.3,
        dataset_text_field="text",
        max_length=512,
        packing=False,
        report_to="none"
    )

    # Pre-format dataset texts
    def map_texts(batch):
        return {"text": [formatting_func(x) for x in [batch]] if not isinstance(batch["instruction"], list) else [formatting_func(dict(zip(batch.keys(), vals))) for vals in zip(*batch.values())]}

    formatted_train = dataset["train"].map(lambda x: {"text": formatting_func(x)})
    formatted_val = dataset["validation"].map(lambda x: {"text": formatting_func(x)})

    trainer = SFTTrainer(
        model=peft_model,
        args=training_args,
        train_dataset=formatted_train,
        eval_dataset=formatted_val,
        peft_config=lora_config,
        processing_class=tokenizer
    )

    print("Starting QLoRA Fine-Tuning...")
    trainer.train()

    print(f"Saving fine-tuned LoRA adapters to {OUTPUT_DIR}...")
    trainer.model.save_pretrained(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print("Fine-tuning completed successfully!")


if __name__ == "__main__":
    main()
